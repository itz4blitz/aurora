import { Logger } from '../utils/Logger';
import { ErrorManager } from '../error/ErrorManager';
import { ErrorSeverity, ModelConfig } from '../types';
import { ConfigManager } from '../config/ConfigManager';

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
  error?: {
    message?: string;
  };
}

export class GeminiService {
  private static instance: GeminiService;
  private readonly logger: Logger;
  private readonly errorManager: ErrorManager;
  private readonly configManager: ConfigManager;
  private readonly API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;
  private abortController: AbortController | null = null;
  private timeouts: NodeJS.Timeout[] = [];

  private constructor() {
    this.logger = Logger.getInstance();
    this.errorManager = ErrorManager.getInstance();
    this.configManager = ConfigManager.getInstance();
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  async generateResponse(prompt: string, config?: Partial<ModelConfig>): Promise<string> {
    try {
      const apiKey = await this.configManager.getGeminiApiKey();
      if (!apiKey) {
        throw new Error('Gemini API key not configured');
      }

      const modelConfig = await this.getModelConfig(config);
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < this.MAX_RETRIES) {
        try {
          const response = await this.makeRequest(prompt, apiKey, modelConfig);
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
      const err = error instanceof Error ? error : new Error(String(error));
      void this.errorManager.handleError(
        err,
        'GeminiService.generateResponse',
        ErrorSeverity.Error
      );
      throw err;
    }
  }

  private async makeRequest(
    prompt: string,
    apiKey: string,
    config: ModelConfig
  ): Promise<Response> {
    const url = `${this.API_BASE}/gemini-pro:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: config.temperature,
          topP: config.topP,
          maxOutputTokens: config.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as GeminiResponse;
      throw new Error(`Gemini API error: ${errorData.error?.message ?? 'Unknown error'}`);
    }

    return response;
  }

  private async processResponse(response: Response): Promise<string> {
    const data = (await response.json()) as GeminiResponse;

    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Invalid response format from Gemini API');
    }

    return candidateText;
  }

  private shouldRetry(error: Error): boolean {
    const retryableErrors = ['rate_limit_exceeded', 'internal_error', 'timeout', 'unavailable'];

    return retryableErrors.some((errorType) => error.message.toLowerCase().includes(errorType));
  }

  private async getModelConfig(config?: Partial<ModelConfig>): Promise<ModelConfig> {
    const settings = await this.configManager.getAllSettings();
    const defaultConfig = settings.modelConfigs['gemini-pro'];

    if (!defaultConfig) {
      throw new Error('Default Gemini configuration not found');
    }

    // Create a strongly typed ModelConfig object
    const mergedConfig: ModelConfig = {
      temperature: config?.temperature ?? defaultConfig.temperature,
      maxTokens: config?.maxTokens ?? defaultConfig.maxTokens,
      topP: config?.topP ?? defaultConfig.topP,
      frequencyPenalty: config?.frequencyPenalty ?? defaultConfig.frequencyPenalty,
      presencePenalty: config?.presencePenalty ?? defaultConfig.presencePenalty,
    };

    // Validate the config values
    if (
      typeof mergedConfig.temperature !== 'number' ||
      typeof mergedConfig.maxTokens !== 'number' ||
      typeof mergedConfig.topP !== 'number' ||
      typeof mergedConfig.frequencyPenalty !== 'number' ||
      typeof mergedConfig.presencePenalty !== 'number'
    ) {
      throw new Error('Invalid model configuration values');
    }

    return mergedConfig;
  }

  private delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, ms);
      this.timeouts.push(timeout);
    });
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const testPrompt = 'Hello, this is a test prompt.';
      const url = `${this.API_BASE}/gemini-pro:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: testPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 10,
          },
        }),
      });

      return response.ok;
    } catch (error) {
      this.logger.error('Error validating Gemini API key', error as Error);
      return false;
    }
  }

  public dispose(): void {
    // Clear singleton instance
    GeminiService.instance = null as unknown as GeminiService;

    // Cancel any pending requests
    this.abortController?.abort();

    // Clear any timeouts
    if (this.timeouts.length > 0) {
      this.timeouts.forEach((timeout) => clearTimeout(timeout));
      this.timeouts = [];
    }

    // Log disposal
    this.logger.info('GeminiService disposed');
  }
}
