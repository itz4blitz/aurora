import * as vscode from 'vscode';
import { SecretStorageService } from '../services/SecretStorageService';
import { Logger } from '../utils/Logger';
import { ErrorManager } from '../error/ErrorManager';
import { ErrorSeverity, AIModel, Settings, ModelConfigs, DEFAULT_MODEL_CONFIGS } from '../types';

export class ConfigManager {
    private static instance: ConfigManager;
    private secretStorage: SecretStorageService;
    private logger: Logger;
    private errorManager: ErrorManager;
    private currentModel: AIModel = 'gpt-3.5-turbo';

    private constructor(
        private readonly context: vscode.ExtensionContext
    ) {
        this.secretStorage = SecretStorageService.getInstance();
        this.logger = Logger.getInstance();
        this.errorManager = ErrorManager.getInstance();
    }

    public static initialize(context: vscode.ExtensionContext): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager(context);
        }
        return ConfigManager.instance;
    }

    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            throw new Error('ConfigManager must be initialized with context first');
        }
        return ConfigManager.instance;
    }

    getShortcuts(): Record<string, string> {
        return this.context.globalState.get('shortcuts', {});
    }

    getAllSettings(): Settings {
        return {
            shortcuts: this.getShortcuts(),
            defaultModel: this.currentModel,
            modelConfigs: this.context.globalState.get('modelConfigs', DEFAULT_MODEL_CONFIGS),
            geminiApiKey: '',  // API keys are retrieved from SecretStorage separately
            openAIApiKey: '',
            anthropicApiKey: '',
            theme: this.context.globalState.get('theme', 'system'),
            fontSize: this.context.globalState.get('fontSize', 14),
            fontFamily: this.context.globalState.get('fontFamily', 'monospace'),
            showLineNumbers: this.context.globalState.get('showLineNumbers', true),
            autoSave: this.context.globalState.get('autoSave', true),
            useMarkdown: this.context.globalState.get('useMarkdown', true)
        };
    }

    async updateSettings(settings: Partial<Settings>): Promise<void> {
        try {
            if (settings.shortcuts) {
                await this.context.globalState.update('shortcuts', settings.shortcuts);
            }
            if (settings.defaultModel) {
                await this.updateDefaultModel(settings.defaultModel);
            }
            if (settings.modelConfigs) {
                await this.context.globalState.update('modelConfigs', settings.modelConfigs);
            }
            if (settings.geminiApiKey) {
                await this.secretStorage.storeGeminiKey(settings.geminiApiKey);
            }
            if (settings.openAIApiKey) {
                await this.secretStorage.setOpenAIKey(settings.openAIApiKey);
            }
            if (settings.anthropicApiKey) {
                await this.secretStorage.setAnthropicKey(settings.anthropicApiKey);
            }
            if (settings.theme) {
                await this.context.globalState.update('theme', settings.theme);
            }
            if (settings.fontSize !== undefined) {
                await this.context.globalState.update('fontSize', settings.fontSize);
            }
            if (settings.fontFamily) {
                await this.context.globalState.update('fontFamily', settings.fontFamily);
            }
            if (settings.showLineNumbers !== undefined) {
                await this.context.globalState.update('showLineNumbers', settings.showLineNumbers);
            }
            if (settings.autoSave !== undefined) {
                await this.context.globalState.update('autoSave', settings.autoSave);
            }
            if (settings.useMarkdown !== undefined) {
                await this.context.globalState.update('useMarkdown', settings.useMarkdown);
            }
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConfigManager.updateSettings',
                ErrorSeverity.Error
            );
            throw error;
        }
    }

    async initializeConfig() {
        try {
            const geminiKey = await this.secretStorage.getGeminiKey();
            if (geminiKey) {
                const isValid = await this.secretStorage.validateGeminiKey(geminiKey);
                if (!isValid) {
                    this.logger.warn('Stored Gemini API key is invalid');
                    await this.secretStorage.deleteGeminiKey();
                }
            }

            const o1proSessionActive = await this.secretStorage.getO1ProSessionState();
            if (!o1proSessionActive && this.currentModel === 'o1pro') {
                this.currentModel = 'gpt-3.5-turbo';
                await this.updateDefaultModel('gpt-3.5-turbo');
            }

            const savedModel = this.context.globalState.get<AIModel>('defaultModel', 'gpt-3.5-turbo');
            this.currentModel = savedModel;

        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConfigManager.initializeConfig',
                ErrorSeverity.Error
            );
        }
    }

    async getDefaultModel(): Promise<AIModel> {
        return this.currentModel;
    }

    async updateDefaultModel(model: AIModel): Promise<void> {
        try {
            if (model === 'gemini-pro') {
                const key = await this.secretStorage.getGeminiKey();
                if (!key) {
                    throw new Error('Gemini API key not configured');
                }
            } else if (model === 'o1pro') {
                const sessionActive = await this.secretStorage.getO1ProSessionState();
                if (!sessionActive) {
                    throw new Error('O1Pro session not active');
                }
            }

            this.currentModel = model;
            await this.context.globalState.update('defaultModel', model);
            this.logger.info(`Updated default model to ${model}`);
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConfigManager.updateDefaultModel',
                ErrorSeverity.Error
            );
            throw error;
        }
    }

    async configureGeminiKey(key: string): Promise<void> {
        try {
            await this.secretStorage.storeGeminiKey(key);
            this.logger.info('Successfully configured Gemini API key');
            
            if (!this.currentModel) {
                await this.updateDefaultModel('gemini-pro');
            }
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConfigManager.configureGeminiKey',
                ErrorSeverity.Error
            );
            throw error;
        }
    }

    async hasValidGeminiKey(): Promise<boolean> {
        try {
            const key = await this.secretStorage.getGeminiKey();
            if (!key) return false;
            return await this.secretStorage.validateGeminiKey(key);
        } catch (error) {
            this.logger.error('Error checking Gemini key validity', error as Error);
            return false;
        }
    }

    async hasValidOpenAIKey(): Promise<boolean> {
        try {
            const key = await this.secretStorage.getOpenAIKey();
            if (!key) return false;
            return await this.secretStorage.validateOpenAIKey(key);
        } catch (error) {
            this.logger.error('Error checking OpenAI key validity', error as Error);
            return false;
        }
    }

    async isO1ProSessionActive(): Promise<boolean> {
        return await this.secretStorage.getO1ProSessionState();
    }

    async setO1ProSessionState(active: boolean): Promise<void> {
        try {
            await this.secretStorage.setO1ProSessionState(active);
            if (active && this.currentModel !== 'o1pro') {
                await this.updateDefaultModel('o1pro');
            } else if (!active && this.currentModel === 'o1pro') {
                await this.updateDefaultModel('gpt-3.5-turbo');
            }
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConfigManager.setO1ProSessionState',
                ErrorSeverity.Error
            );
            throw error;
        }
    }

    async getGeminiApiKey(): Promise<string | undefined> {
        try {
            return await this.secretStorage.getGeminiKey();
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConfigManager.getGeminiApiKey',
                ErrorSeverity.Error
            );
            return undefined;
        }
    }

    async validateModelConfig(model: AIModel): Promise<boolean> {
        try {
            switch (model) {
                case 'gemini-pro':
                    return await this.hasValidGeminiKey();
                case 'o1pro':
                    return await this.isO1ProSessionActive();
                case 'gpt-3.5-turbo':
                case 'gpt-4':
                    const key = await this.secretStorage.getOpenAIKey();
                    return !!key;
                default:
                    return false;
            }
        } catch (error) {
            this.logger.error(`Error validating model config for ${model}`, error as Error);
            return false;
        }
    }

    async updateModelConfig(model: AIModel, config: Partial<ModelConfigs[AIModel]>): Promise<void> {
        try {
            const currentConfigs = this.context.globalState.get('modelConfigs', DEFAULT_MODEL_CONFIGS);
            await this.context.globalState.update('modelConfigs', {
                ...currentConfigs,
                [model]: {
                    ...currentConfigs[model],
                    ...config
                }
            });
            this.logger.info(`Updated config for model ${model}`);
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConfigManager.updateModelConfig',
                ErrorSeverity.Error
            );
        }
    }

    async getOpenAIApiKey(): Promise<string | undefined> {
        try {
            return await this.secretStorage.getOpenAIKey();
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConfigManager.getOpenAIApiKey',
                ErrorSeverity.Error
            );
            return undefined;
        }
    }

    async configureOpenAIKey(key: string): Promise<void> {
        try {
            await this.secretStorage.setOpenAIKey(key);
            this.logger.info('Successfully configured OpenAI API key');
            
            if (!this.currentModel) {
                await this.updateDefaultModel('gpt-3.5-turbo');
            }
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConfigManager.configureOpenAIKey',
                ErrorSeverity.Error
            );
            throw error;
        }
    }

    async getAnthropicApiKey(): Promise<string | undefined> {
        try {
            return await this.secretStorage.getAnthropicKey();
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConfigManager.getAnthropicApiKey',
                ErrorSeverity.Error
            );
            return undefined;
        }
    }

    async configureAnthropicKey(key: string): Promise<void> {
        try {
            await this.secretStorage.setAnthropicKey(key);
            this.logger.info('Successfully configured Anthropic API key');
            
            if (!this.currentModel) {
                await this.updateDefaultModel('claude-3-sonnet');
            }
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConfigManager.configureAnthropicKey',
                ErrorSeverity.Error
            );
            throw error;
        }
    }

    async hasValidAnthropicKey(): Promise<boolean> {
        try {
            const key = await this.secretStorage.getAnthropicKey();
            if (!key) return false;
            return await this.secretStorage.validateAnthropicKey(key);
        } catch (error) {
            this.logger.error('Error checking Anthropic key validity', error as Error);
            return false;
        }
    }
} 
