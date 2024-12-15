import * as vscode from 'vscode';
import { Logger } from './utils/Logger';
import { ErrorManager } from './error/ErrorManager';

export interface Conversation {
    id: string;
    title: string;
    create_time: string;
    update_time: string;
    is_starred: boolean;
    is_pinned: boolean;
    model: 'chatgpt' | 'gemini';
    messages: Message[];
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    create_time: string;
}

export interface AuroraConfig {
    geminiApiKey: string;
    o1proAuthToken: string;
    defaultModel: 'chatgpt' | 'gemini';
    shortcuts: {
        toggleModel: string;
        newConversation: string;
        searchConversations: string;
    };
    categories: string[];
}

export type AIModelProvider = 
    | 'openai'    // GPT models
    | 'anthropic' // Claude models
    | 'google'    // Gemini models
    | 'o1pro'     // O1Pro
    | 'ollama'    // Local models via Ollama
    | 'lmstudio'  // Local models via LM Studio
    | 'custom';   // Other local/custom model servers

export interface LocalModel {
    name: string;
    provider: 'ollama' | 'lmstudio' | 'custom';
    endpoint?: string;
    contextSize?: number;
    metadata?: Record<string, any>;
}

export type AIModel =
    | 'gpt-3.5-turbo'
    | 'gpt-4'
    | 'gemini-pro'
    | 'claude-3-sonnet'
    | 'o1pro';

export interface AIModelConfig {
    type: AIModel;
    config: Record<string, any>;
}

export interface ModelConfig {
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
    stopSequences?: string[];
}

export interface ModelConfigs {
    'gpt-3.5-turbo': ModelConfig;
    'gpt-4': ModelConfig;
    'gemini-pro': ModelConfig;
    'claude-3-sonnet': ModelConfig;
    'o1pro': ModelConfig;
}

export const DEFAULT_MODEL_CONFIGS: ModelConfigs = {
    'gpt-3.5-turbo': {
        maxTokens: 4096,
        temperature: 0.7,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0
    },
    'gpt-4': {
        maxTokens: 8192,
        temperature: 0.7,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0
    },
    'gemini-pro': {
        maxTokens: 30720,
        temperature: 0.7,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0
    },
    'claude-3-sonnet': {
        maxTokens: 200000,
        temperature: 0.7,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0
    },
    'o1pro': {
        maxTokens: 8192,
        temperature: 0.7,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0
    }
};

export interface Settings {
    shortcuts: { [key: string]: string };
    defaultModel: AIModel;
    modelConfigs: Partial<ModelConfigs>;
    geminiApiKey: string;
    openAIApiKey: string;
    anthropicApiKey: string;
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    fontFamily: string;
    showLineNumbers: boolean;
    autoSave: boolean;
    useMarkdown: boolean;
}

export interface CodeChange {
    range: vscode.Range;
    newText: string;
    original: string;
}

export interface ScrapedResponse {
    suggestedCode: string;
    explanation?: string;
    metadata?: Record<string, any>;
}

export interface DiffChange {
    original: string;
    suggested: string;
    range: vscode.Range;
    status: 'pending' | 'accepted' | 'rejected';
}

export interface WebviewMessage {
    type: string;
    [key: string]: any;
}

export interface ConversationHistory {
    id: string;
    model: 'o1pro' | 'gemini';
    messages: Message[];
    forwardedFrom?: {
        id: string;
        model: 'o1pro' | 'gemini';
    };
}

export enum ErrorSeverity {
    Info = 'info',
    Warning = 'warning',
    Error = 'error',
    Critical = 'critical'
}

export class ModelSwitcher {
    private readonly logger: Logger;
    private readonly errorManager: ErrorManager;
    private static instance: ModelSwitcher;

    private constructor() {
        this.logger = Logger.getInstance();
        this.errorManager = ErrorManager.getInstance();
    }

    public static getInstance(): ModelSwitcher {
        if (!ModelSwitcher.instance) {
            ModelSwitcher.instance = new ModelSwitcher();
        }
        return ModelSwitcher.instance;
    }

    async forwardConversation(
        conversation: ConversationHistory, 
        targetModel: 'o1pro' | 'gemini'
    ): Promise<ConversationHistory> {
        try {
            if (conversation.model === targetModel) {
                throw new Error(`Conversation is already using ${targetModel} model`);
            }

            // Create new conversation with reference to original
            const newConversation: ConversationHistory = {
                id: crypto.randomUUID(),
                model: targetModel,
                messages: this.adaptMessages(conversation.messages, targetModel),
                forwardedFrom: {
                    id: conversation.id,
                    model: conversation.model
                }
            };

            this.logger.info(`Forwarded conversation ${conversation.id} to ${targetModel}`);
            return newConversation;
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ModelSwitcher.forwardConversation',
                ErrorSeverity.Error
            );
            throw error;
        }
    }

    private adaptMessages(messages: Message[], targetModel: 'o1pro' | 'gemini'): Message[] {
        return messages.map(msg => ({
            id: crypto.randomUUID(),
            role: msg.role,
            content: this.adaptMessageContent(msg.content, targetModel),
            create_time: new Date().toISOString()
        }));
    }

    private adaptMessageContent(content: string, targetModel: 'o1pro' | 'gemini'): string {
        // Add any model-specific content adaptations here
        // For example, formatting code blocks differently or adding model-specific prefixes
        if (targetModel === 'gemini') {
            return this.adaptForGemini(content);
        } else {
            return this.adaptForO1Pro(content);
        }
    }

    private adaptForGemini(content: string): string {
        // Gemini-specific adaptations
        // For example, ensuring code blocks are properly formatted
        return content.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
            return `Here's the code in ${lang || 'plain text'}:\n${code.trim()}`;
        });
    }

    private adaptForO1Pro(content: string): string {
        // O1Pro-specific adaptations
        // For example, ensuring proper markdown formatting
        return content.replace(/^/gm, content.includes('```') ? '' : '> ');
    }

    async validateModelSwitch(
        conversation: ConversationHistory,
        targetModel: 'o1pro' | 'gemini'
    ): Promise<boolean> {
        try {
            // Add any validation logic here
            // For example, checking if the target model supports the conversation format
            if (conversation.messages.length === 0) {
                throw new Error('Cannot forward empty conversation');
            }

            // Check if the conversation contains unsupported content
            const hasUnsupportedContent = conversation.messages.some(msg => 
                this.hasUnsupportedContent(msg.content, targetModel)
            );

            if (hasUnsupportedContent) {
                throw new Error(`Some content may not be supported by ${targetModel}`);
            }

            return true;
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ModelSwitcher.validateModelSwitch',
                ErrorSeverity.Warning
            );
            return false;
        }
    }

    private hasUnsupportedContent(content: string, targetModel: 'o1pro' | 'gemini'): boolean {
        // Add checks for unsupported content types
        // For example, Gemini might not support certain markdown features
        if (targetModel === 'gemini') {
            // Check for unsupported Gemini features
            return content.includes('$$') || // LaTeX
                   content.includes('<script>'); // HTML scripts
        } else {
            // Check for unsupported O1Pro features
            return false; // O1Pro generally supports most content types
        }
    }

    async getModelCapabilities(model: 'o1pro' | 'gemini'): Promise<Record<string, boolean>> {
        // Return model-specific capabilities
        return {
            supportsCodeCompletion: true,
            supportsMarkdown: model === 'o1pro',
            supportsStreaming: true,
            supportsCodeExplanation: true,
            supportsMultipleLanguages: true,
            supportsInlineEditing: model === 'o1pro'
        };
    }
} 