import * as vscode from 'vscode';
import { Conversation } from '../types';
import { Logger } from '../utils/Logger';

export class ConversationVisualizer {
    private static instance: ConversationVisualizer;
    private readonly logger = Logger.getInstance();

    private constructor() {}

    static getInstance(): ConversationVisualizer {
        if (!ConversationVisualizer.instance) {
            ConversationVisualizer.instance = new ConversationVisualizer();
        }
        return ConversationVisualizer.instance;
    }

    async visualizeHistory(conversations: Conversation[]): Promise<string> {
        try {
            const grouped = this.groupByDate(conversations);
            return this.generateHTML(grouped);
        } catch (error) {
            this.logger.error('Error visualizing conversation history', error as Error);
            throw error;
        }
    }

    private groupByDate(conversations: Conversation[]): Map<string, Conversation[]> {
        const grouped = new Map<string, Conversation[]>();
        
        conversations.forEach(conv => {
            const date = new Date(conv.create_time).toLocaleDateString();
            if (!grouped.has(date)) {
                grouped.set(date, []);
            }
            grouped.get(date)?.push(conv);
        });

        return grouped;
    }

    private generateHTML(grouped: Map<string, Conversation[]>): string {
        const dates = Array.from(grouped.keys()).sort().reverse();
        
        return `
            <div class="history-container">
                ${dates.map(date => `
                    <div class="date-group">
                        <h3 class="date-header">${date}</h3>
                        <div class="conversation-group">
                            ${grouped.get(date)?.map(conv => `
                                <div class="conversation-card" data-id="${conv.id}">
                                    <div class="conversation-header">
                                        <span class="title">${this.escapeHtml(conv.title)}</span>
                                        <span class="model-badge ${conv.model || 'chatgpt'}">${conv.model || 'ChatGPT'}</span>
                                    </div>
                                    <div class="conversation-meta">
                                        <span class="time">${new Date(conv.create_time).toLocaleTimeString()}</span>
                                        ${conv.is_starred ? '<span class="star">★</span>' : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
} 