import * as vscode from 'vscode';
import { Conversation } from './types';
import { GeminiService } from './services/GeminiService';
import { Logger } from './utils/Logger';

interface ChatGPTResponse {
  conversation_id: string;
  message: {
    id: string;
    content: {
      parts: string[];
    };
    author: {
      role: string;
    };
  };
}

interface ConversationData {
  items: Conversation[];
}

type MessageResponse = ChatGPTResponse | string;

export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private geminiService: GeminiService;
  private readonly logger = Logger.getInstance();

  constructor(private readonly authToken: string) {
    this.geminiService = GeminiService.getInstance();
  }

  async fetchConversations(): Promise<Conversation[]> {
    try {
      const response = await fetch(
        'https://chatgpt.com/backend-api/conversations?offset=0&limit=28&order=updated',
        {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as ConversationData;
      const conversations = data.items;

      // Update local cache
      conversations.forEach((conv) => {
        this.conversations.set(conv.id, conv);
      });

      return conversations;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      void vscode.window.showErrorMessage(`Failed to fetch conversations: ${errorMessage}`);
      throw error;
    }
  }

  async sendMessage(
    content: string,
    model: 'chatgpt' | 'gemini',
    conversationId?: string
  ): Promise<MessageResponse> {
    try {
      if (model === 'gemini') {
        return await this.sendGeminiMessage(content);
      }
      return await this.sendChatGPTMessage(content, conversationId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      void vscode.window.showErrorMessage(`Failed to send message: ${errorMessage}`);
      throw error;
    }
  }

  private async sendGeminiMessage(content: string): Promise<string> {
    return this.geminiService.generateResponse(content);
  }

  private async sendChatGPTMessage(
    content: string,
    conversationId?: string
  ): Promise<ChatGPTResponse> {
    const response = await fetch('https://chatgpt.com/backend-alt/conversation', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'next',
        messages: [
          {
            id: this.generateUUID(),
            author: { role: 'user' },
            content: {
              content_type: 'text',
              parts: [content],
            },
          },
        ],
        model: 'o1-pro',
        conversation_id: conversationId,
      }),
    });

    if (!response.ok) {
      throw new Error(`ChatGPT API error: ${response.statusText}`);
    }

    const result = (await response.json()) as ChatGPTResponse;

    if (result.conversation_id && !this.conversations.has(result.conversation_id)) {
      void this.fetchConversations(); // Refresh conversation list
    }

    return result;
  }

  async deleteConversation(id: string): Promise<void> {
    try {
      const response = await fetch(`https://chatgpt.com/backend-api/conversation/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      this.conversations.delete(id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      void vscode.window.showErrorMessage(`Failed to delete conversation: ${errorMessage}`);
      throw error;
    }
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    try {
      const response = await fetch(`https://chatgpt.com/backend-api/conversation/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error('Failed to update conversation title');
      }

      const conversation = this.conversations.get(id);
      if (conversation) {
        conversation.title = title;
        this.conversations.set(id, conversation);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      void vscode.window.showErrorMessage(`Failed to update conversation title: ${errorMessage}`);
      throw error;
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values());
  }

  async toggleConversationPin(conversationId: string): Promise<void> {
    try {
      const conversation = this.getConversation(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const isPinned = !conversation.is_pinned;

      const response = await fetch(
        `https://chatgpt.com/backend-api/conversation/${conversationId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            is_pinned: isPinned,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${isPinned ? 'pin' : 'unpin'} conversation`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Failed to toggle conversation pin', errorMessage);
      throw error;
    }
  }

  async toggleConversationStar(conversationId: string): Promise<void> {
    try {
      const conversation = this.getConversation(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const isStarred = !conversation.is_starred;

      const response = await fetch(
        `https://chatgpt.com/backend-api/conversation/${conversationId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            is_starred: isStarred,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${isStarred ? 'star' : 'unstar'} conversation`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error : new Error('Unknown error');
      this.logger.error('Failed to toggle conversation star', errorMessage);
      throw error;
    }
  }
}
