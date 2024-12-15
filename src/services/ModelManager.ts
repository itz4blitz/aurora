import { Logger } from '../utils/Logger';
import { ErrorManager } from '../error/ErrorManager';
import { ConfigManager } from '../config/ConfigManager';
import { OpenAIService } from './OpenAIService';
import { GeminiService } from './GeminiService';
import { AnthropicService } from './AnthropicService';
import { O1ProService } from './O1ProService';
import { AIModel, ErrorSeverity, ModelConfig } from '../types';

export class ModelManager {
    private static instance: ModelManager;
    private readonly logger: Logger;
    private readonly errorManager: ErrorManager;
    private readonly configManager: ConfigManager;
    private readonly openAIService: OpenAIService;
    private readonly geminiService: GeminiService;
    private readonly anthropicService: AnthropicService;
    private readonly o1proService: O1ProService;

    private constructor() {
        this.logger = Logger.getInstance();
        this.errorManager = ErrorManager.getInstance();
        this.configManager = ConfigManager.getInstance();
        this.openAIService = OpenAIService.getInstance();
        this.geminiService = GeminiService.getInstance();
        this.anthropicService = AnthropicService.getInstance();
        this.o1proService = O1ProService.getInstance();
    }

    public static getInstance(): ModelManager {
        if (!ModelManager.instance) {
            ModelManager.instance = new ModelManager();
        }
        return ModelManager.instance;
    }

    async generateResponse(prompt: string, model?: AIModel, config?: Partial<ModelConfig>): Promise<string> {
        try {
            const selectedModel = model || await this.configManager.getDefaultModel();
            
            if (!(await this.validateModel(selectedModel))) {
                throw new Error(`Model ${selectedModel} is not properly configured`);
            }

            switch (selectedModel) {
                case 'gpt-3.5-turbo':
                case 'gpt-4':
                    return await this.openAIService.generateResponse(prompt, selectedModel, config);
                
                case 'gemini-pro':
                    return await this.geminiService.generateResponse(prompt, config);
                
                case 'claude-3-sonnet':
                    return await this.anthropicService.generateResponse(prompt, selectedModel, config);
                
                case 'o1pro':
                    return await this.o1proService.generateResponse(prompt);
                
                default:
                    throw new Error(`Unsupported model: ${selectedModel}`);
            }
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ModelManager.generateResponse',
                ErrorSeverity.Error
            );
            throw error;
        }
    }

    async validateModel(model: AIModel): Promise<boolean> {
        try {
            switch (model) {
                case 'gpt-3.5-turbo':
                case 'gpt-4':
                    return await this.configManager.hasValidOpenAIKey();
                
                case 'gemini-pro':
                    return await this.configManager.hasValidGeminiKey();
                
                case 'claude-3-sonnet':
                    return await this.configManager.hasValidAnthropicKey();
                
                case 'o1pro':
                    return await this.configManager.isO1ProSessionActive();
                
                default:
                    return false;
            }
        } catch (error) {
            this.logger.error(`Error validating model ${model}`, error as Error);
            return false;
        }
    }

    async switchModel(model: AIModel): Promise<boolean> {
        try {
            if (await this.validateModel(model)) {
                await this.configManager.updateDefaultModel(model);
                this.logger.info(`Successfully switched to model: ${model}`);
                return true;
            }
            return false;
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ModelManager.switchModel',
                ErrorSeverity.Error
            );
            return false;
        }
    }

    async getModelCapabilities(model: AIModel): Promise<Record<string, boolean>> {
        const baseCapabilities = {
            supportsStreaming: true,
            supportsCodeCompletion: true,
            supportsMarkdown: true,
            supportsVision: false
        };

        switch (model) {
            case 'gpt-4':
                return {
                    ...baseCapabilities,
                    supportsVision: true
                };
            case 'claude-3-sonnet':
                return {
                    ...baseCapabilities,
                    supportsVision: true
                };
            default:
                return baseCapabilities;
        }
    }

    dispose() {
        ModelManager.instance = null as unknown as ModelManager;
        this.openAIService.dispose();
        this.geminiService.dispose();
        this.anthropicService.dispose();
        this.o1proService.dispose();
        this.logger.info('ModelManager disposed');
    }
} 