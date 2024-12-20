import { Logger } from '@utils/Logger';
import { ErrorManager } from '@error/ErrorManager';
import { ErrorSeverity, ModelConfig, Settings } from '@types';
import { ConfigManager } from '@config/ConfigManager';

interface OpenAIError {
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
    index: number;
  }>;
}

export class OpenAIService {
  private static instance: OpenAIService;
  private readonly logger: Logger;
  private readonly errorManager: ErrorManager;
  private readonly configManager: ConfigManager;
  private readonly API_BASE = 'https://api.openai.com/v1';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private abortController: AbortController | null = null;
  private timeouts: NodeJS.Timeout[] = [];

  private constructor() {
    this.logger = Logger.getInstance();
    this.errorManager = ErrorManager.getInstance();
    this.configManager = ConfigManager.getInstance();
  }

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  async generateResponse(
    prompt: string,
    model: 'gpt-3.5-turbo' | 'gpt-4',
    config?: Partial<ModelConfig>
  ): Promise<string> {
    try {
      const apiKey = await this.configManager.getOpenAIApiKey();
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const modelConfig = await this.getModelConfig(model, config);
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < this.MAX_RETRIES) {
        try {
          const response = await this.makeRequest(prompt, model, apiKey, modelConfig);
          return this.processResponse(response);
        } catch (error) {
          lastError = error as Error;
          if (this.shouldRetry(error as Error)) {
            attempt++;
            await this.delay(this.RETRY_DELAY * attempt);
            continue;
          }
          throw error;
        }
      }

      throw lastError || new Error('Failed to generate response after retries');
    } catch (error) {
      void this.errorManager.handleError(
        error as Error,
        'OpenAIService.generateResponse',
        ErrorSeverity.Error
      );
      throw error;
    }
  }

  private async makeRequest(
    prompt: string,
    model: string,
    apiKey: string,
    config: ModelConfig
  ): Promise<Response> {
    this.abortController = new AbortController();

    const response = await fetch(`${this.API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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
        frequency_penalty: config.frequencyPenalty,
        presence_penalty: config.presencePenalty,
      }),
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      const errorData = (await response.json()) as OpenAIError;
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    return response;
  }

  private async processResponse(response: Response): Promise<string> {
    const data = (await response.json()) as OpenAIResponse;

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from OpenAI API');
    }

    return data.choices[0].message.content;
  }

  private shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'rate_limit_exceeded',
      'internal_error',
      'timeout',
      'insufficient_quota',
      'server_error',
    ];

    return retryableErrors.some((errorType) => error.message.toLowerCase().includes(errorType));
  }

  private async getModelConfig(
    model: 'gpt-3.5-turbo' | 'gpt-4',
    config?: Partial<ModelConfig>
  ): Promise<ModelConfig> {
    const settings = await this.configManager.getAllSettings();

    if (!this.isValidModel(model, settings)) {
      throw new Error(`Default configuration not found for model: ${String(model)}`);
    }

    const defaultConfig = settings.modelConfigs[model] as ModelConfig;

    const modelConfig: ModelConfig = {
      temperature: this.getConfigValue(config?.temperature, defaultConfig.temperature),
      maxTokens: this.getConfigValue(config?.maxTokens, defaultConfig.maxTokens),
      topP: this.getConfigValue(config?.topP, defaultConfig.topP),
      frequencyPenalty: this.getConfigValue(
        config?.frequencyPenalty,
        defaultConfig.frequencyPenalty
      ),
      presencePenalty: this.getConfigValue(config?.presencePenalty, defaultConfig.presencePenalty),
    };

    return modelConfig;
  }

  private isValidModel(model: 'gpt-3.5-turbo' | 'gpt-4', settings: Settings): boolean {
    return model in settings.modelConfigs;
  }

  private getConfigValue<T>(configValue: T | undefined, defaultValue: T): T {
    return configValue ?? defaultValue;
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
          Authorization: `Bearer ${apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      this.logger.error('Error validating OpenAI API key', error as Error);
      return false;
    }
  }

  dispose(): void {
    // Clear singleton instance
    OpenAIService.instance = null as unknown as OpenAIService;

    // Cancel any pending requests
    this.abortController?.abort();

    // Clear any timeouts
    if (this.timeouts.length > 0) {
      this.timeouts.forEach((timeout) => clearTimeout(timeout));
      this.timeouts = [];
    }

    // Log disposal
    this.logger.info('OpenAIService disposed');
  }
}
