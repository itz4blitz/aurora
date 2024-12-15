import * as vscode from 'vscode';
import { Conversation } from '@/types';
import { GeminiService } from '@services/GeminiService';
import { ConfigManager } from '@config/ConfigManager';
import { Logger } from '@utils/Logger';

export class ConversationManager {
    private conversations: Map<string, Conversation> = new Map();
    private geminiService: GeminiService;
    private configManager: ConfigManager;
    private readonly logger = Logger.getInstance();
    
    constructor(private readonly authToken: string) {
        this.geminiService = GeminiService.getInstance();
        this.configManager = ConfigManager.getInstance();
    }

    async fetchConversations(): Promise<Conversation[]> {
        try {
            const response = await fetch('https://chatgpt.com/backend-api/conversations?offset=0&limit=28&order=updated', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const conversations = data.items as Conversation[];
            
            // Update local cache
            conversations.forEach(conv => {
                this.conversations.set(conv.id, conv);
            });

            return conversations;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch conversations: ${error}`);
            throw error;
        }
    }

    async sendMessage(content: string, model: 'chatgpt' | 'gemini', conversationId?: string): Promise<any> {
        try {
            if (model === 'gemini') {
                return await this.sendGeminiMessage(content);
            }
            return await this.sendChatGPTMessage(content, conversationId);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to send message: ${error}`);
            throw error;
        }
    }

    private async sendGeminiMessage(content: string): Promise<any> {
        return await this.geminiService.generateResponse(content);
    }

    private async sendChatGPTMessage(content: string, conversationId?: string): Promise<any> {
        const response = await fetch('https://chatgpt.com/backend-alt/conversation', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: "next",
                messages: [{
                    id: this.generateUUID(),
                    author: { role: "user" },
                    content: {
                        content_type: "text",
                        parts: [content]
                    }
                }],
                model: "o1-pro",
                conversation_id: conversationId
            })
        });

        if (!response.ok) {
            throw new Error(`ChatGPT API error: ${response.statusText}`);
        }

        const result = await response.json();
        
        // Update conversation in cache if it's a new one
        if (result.conversation_id && !this.conversations.has(result.conversation_id)) {
            await this.fetchConversations(); // Refresh conversation list
        }
2
        return result;
    }

    async deleteConversation(id: string): Promise<void> {
        try {
            const response = await fetch(`https://chatgpt.com/backend-api/conversation/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });
2
            if (!response.ok) {
                throw new Error('Failed to delete conversation');
            }

            this.conversations.delete(id);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete conversation: ${error}`);
            throw error;
        }
    }

    async updateConversationTitle(id: string, title: string): Promise<void> {
        try {
            const response = await fetch(`https://chatgpt.com/backend-api/conversation/${id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title })
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
            vscode.window.showErrorMessage(`Failed to update conversation title: ${error}`);
            throw error;
        }
    }

    async starConversation(id: string, starred: boolean): Promise<void> {
        try {
            const response = await fetch(`https://chatgpt.com/backend-api/conversation/${id}/star`, {
                method: starred ? 'POST' : 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to update star status');
            }

            const conversation = this.conversations.get(id);
            if (conversation) {
                conversation.is_starred = starred;
                this.conversations.set(id, conversation);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to star conversation: ${error}`);
            throw error;
        }
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
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
            const conversation = await this.getConversation(conversationId);
            if (!conversation) {
                throw new Error('Conversation not found');
            }

            const isPinned = !conversation.is_pinned;
            
            const response = await fetch(`https://chatgpt.com/backend-api/conversation/${conversationId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    is_pinned: isPinned
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to ${isPinned ? 'pin' : 'unpin'} conversation`);
            }
        } catch (error) {
            this.logger.error('Failed to toggle conversation pin', error as Error);
            throw error;
        }
    }

    async toggleConversationStar(conversationId: string): Promise<void> {
        try {
            const conversation = await this.getConversation(conversationId);
            if (!conversation) {
                throw new Error('Conversation not found');
            }

            const isStarred = !conversation.is_starred;
            
            const response = await fetch(`https://chatgpt.com/backend-api/conversation/${conversationId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    is_starred: isStarred
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to ${isStarred ? 'star' : 'unstar'} conversation`);
            }
        } catch (error) {
            this.logger.error('Failed to toggle conversation star', error as Error);
            throw error;
        }
    }
} 