import { Logger } from '../utils/Logger';
import { ErrorManager } from '../error/ErrorManager';
import { ErrorSeverity, ModelConfig } from '../types';
import { ConfigManager } from '../config/ConfigManager';

interface AnthropicResponse {
  content: Array<{
    text: string;
  }>;
}

interface AnthropicErrorResponse {
  error?: {
    message: string;
  };
}

export class AnthropicService {
  private static instance: AnthropicService;
  private readonly logger: Logger;
  private readonly errorManager: ErrorManager;
  private readonly configManager: ConfigManager;
  private readonly API_BASE = 'https://api.anthropic.com/v1';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private abortController: AbortController | null = null;
  private timeouts: NodeJS.Timeout[] = [];

  private constructor() {
    this.logger = Logger.getInstance();
    this.errorManager = ErrorManager.getInstance();
    this.configManager = ConfigManager.getInstance();
  }

  public static getInstance(): AnthropicService {
    if (!AnthropicService.instance) {
      AnthropicService.instance = new AnthropicService();
    }
    return AnthropicService.instance;
  }

  async generateResponse(
    prompt: string,
    model: 'claude-3-sonnet',
    config?: Partial<ModelConfig>
  ): Promise<string> {
    try {
      const apiKey = await this.configManager.getAnthropicApiKey();
      if (!apiKey) {
        throw new Error('Anthropic API key not configured');
      }

      const modelConfig = await this.getModelConfig(model, config);
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < this.MAX_RETRIES) {
        try {
          const response = await this.makeRequest(prompt, model, apiKey, modelConfig);
          return await this.processResponse(response);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          if (this.shouldRetry(lastError)) {
            attempt++;
            await this.delay(this.RETRY_DELAY * attempt);
            continue;
          }
          throw lastError;
        }
      }

      throw lastError || new Error('Failed to generate response after retries');
    } catch (error) {
      const typedError = error instanceof Error ? error : new Error('Unknown error');
      void this.errorManager.handleError(
        typedError,
        'AnthropicService.generateResponse',
        ErrorSeverity.Error
      );
      throw typedError;
    }
  }

  private async makeRequest(
    prompt: string,
    model: string,
    apiKey: string,
    config: ModelConfig
  ): Promise<Response> {
    this.abortController = new AbortController();

    const response = await fetch(`${this.API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        top_p: config.topP,
      }),
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      const errorData = (await response.json()) as AnthropicErrorResponse;
      throw new Error(`Anthropic API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    return response;
  }

  private async processResponse(response: Response): Promise<string> {
    const data = (await response.json()) as AnthropicResponse;

    if (!data.content?.[0]?.text) {
      throw new Error('Invalid response format from Anthropic API');
    }

    return data.content[0].text;
  }

  private shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'rate_limit_exceeded',
      'internal_error',
      'timeout',
      'insufficient_quota',
      'server_error',
      'overloaded',
    ];

    return retryableErrors.some((errorType) => error.message.toLowerCase().includes(errorType));
  }

  private async getModelConfig(model: string, config?: Partial<ModelConfig>): Promise<ModelConfig> {
    const settings = await this.configManager.getAllSettings();
    const defaultConfig = settings.modelConfigs[model as keyof typeof settings.modelConfigs];

    if (!defaultConfig) {
      throw new Error(`Default configuration not found for model: ${model}`);
    }

    const modelConfig: ModelConfig = {
      temperature: config?.temperature ?? defaultConfig.temperature,
      maxTokens: config?.maxTokens ?? defaultConfig.maxTokens,
      topP: config?.topP ?? defaultConfig.topP,
      frequencyPenalty: config?.frequencyPenalty ?? defaultConfig.frequencyPenalty,
      presencePenalty: config?.presencePenalty ?? defaultConfig.presencePenalty,
    };

    return modelConfig;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, ms);
      this.timeouts.push(timeout);
    });
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE}/models`, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });

      return response.ok;
    } catch (error) {
      this.logger.error('Error validating Anthropic API key', error as Error);
      return false;
    }
  }

  public dispose(): void {
    // Clear singleton instance
    AnthropicService.instance = null as unknown as AnthropicService;

    // Cancel any pending requests
    if (this.abortController) {
      void this.abortController.abort();
    }

    // Clear any timeouts
    this.timeouts.forEach((timeout) => clearTimeout(timeout));
    this.timeouts = [];

    // Log disposal
    this.logger.info('AnthropicService disposed');
  }
}
