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
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
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
  | 'openai' // GPT models
  | 'anthropic' // Claude models
  | 'google' // Gemini models
  | 'o1pro' // O1Pro
  | 'ollama' // Local models via Ollama
  | 'lmstudio' // Local models via LM Studio
  | 'custom'; // Other local/custom model servers

export interface LocalModel {
  name: string;
  provider: 'ollama' | 'lmstudio' | 'custom';
  endpoint?: string;
  contextSize?: number;
  metadata?: Record<string, string | number | boolean>;
}

export type AIModel = 'gpt-3.5-turbo' | 'gpt-4' | 'gemini-pro' | 'claude-3-sonnet' | 'o1pro';

export interface ModelConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export interface ModelConfigWithType extends ModelConfig {
  type: AIModel;
}

export interface ModelConfigs {
  'gpt-3.5-turbo': ModelConfig;
  'gpt-4': ModelConfig;
  'gemini-pro': ModelConfig;
  'claude-3-sonnet': ModelConfig;
  o1pro: ModelConfig;
}

// Token limits based on official documentation
export const MODEL_TOKEN_LIMITS = {
  'gpt-3.5-turbo': 16385, // OpenAI's GPT-3.5 Turbo latest version
  'gpt-4': 8192, // Base GPT-4 model
  'gemini-pro': 32768, // Google's Gemini Pro limit
  'claude-3-sonnet': 200000, // Anthropic's Claude 3 Sonnet
  o1pro: 128000, // OpenAI's O1 Pro (128K input context window)
} as const;

export const DEFAULT_MODEL_CONFIGS: Record<AIModel, ModelConfig> = {
  'gpt-3.5-turbo': {
    maxTokens: MODEL_TOKEN_LIMITS['gpt-3.5-turbo'],
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  'gpt-4': {
    maxTokens: MODEL_TOKEN_LIMITS['gpt-4'],
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  'gemini-pro': {
    maxTokens: MODEL_TOKEN_LIMITS['gemini-pro'],
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  'claude-3-sonnet': {
    maxTokens: MODEL_TOKEN_LIMITS['claude-3-sonnet'],
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  o1pro: {
    maxTokens: MODEL_TOKEN_LIMITS['o1pro'],
    temperature: 0.7,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
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
  text: string;
  responseType: string;
  language?: string;
  confidence?: number;
}

export interface DiffChange {
  original: string;
  suggested: string;
  range: vscode.Range;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface WebviewMessage {
  type:
    | 'switchModel'
    | 'o1proResponse'
    | 'acceptAllChanges'
    | 'acceptNextChange'
    | 'rejectChanges'
    | 'acceptDiff'
    | 'rejectDiff'
    | 'acceptAllDiffs'
    | 'rejectAllDiffs'
    | 'updateSettings'
    | 'getSettings'
    | 'resetSettings'
    | 'settingsLoaded';
  model?: AIModel;
  response?: ScrapedResponse;
  content?: string;
  settings?: Partial<Settings>;
  messages?: Message[];
  modelConfig?: ModelConfig;
  scrollPosition?: number;
  pendingInput?: string;
  diffId?: number;
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
  Critical = 'critical',
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
          model: conversation.model,
        },
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
    return messages.map((msg) => ({
      id: crypto.randomUUID(),
      role: msg.role,
      content: this.adaptMessageContent(msg.content, targetModel),
      timestamp: new Date().getTime(),
    }));
  }

  private adaptMessageContent(content: string, targetModel: 'o1pro' | 'gemini'): string {
    // Type-safe string handling
    const safeContent = String(content);

    if (targetModel === 'gemini') {
      return this.adaptForGemini(safeContent);
    } else {
      return this.adaptForO1Pro(safeContent);
    }
  }

  private adaptForGemini(content: string): string {
    return content.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      (_match: string, lang: string | undefined, code: string) => {
        const language = lang || 'plain text';
        return `Here's the code in ${language}:\n${code.trim()}`;
      }
    );
  }

  private adaptForO1Pro(content: string): string {
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
      const hasUnsupportedContent = conversation.messages.some((msg) =>
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
      return (
        content.includes('$$') || // LaTeX
        content.includes('<script>')
      ); // HTML scripts
    } else {
      // Check for unsupported O1Pro features
      return false; // O1Pro generally supports most content types
    }
  }

  async getModelCapabilities(model: 'o1pro' | 'gemini'): Promise<Record<string, boolean>> {
    // Simulate async operation
    await Promise.resolve();

    return {
      supportsCodeCompletion: true,
      supportsMarkdown: model === 'o1pro',
      supportsStreaming: true,
      supportsCodeExplanation: true,
      supportsMultipleLanguages: true,
      supportsInlineEditing: model === 'o1pro',
    };
  }
}

export interface WebviewState {
  messages?: Message[];
  modelConfig?: ModelConfig;
  scrollPosition?: number;
  pendingInput?: string;
}
