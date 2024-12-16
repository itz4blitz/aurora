import { Conversation } from '../types';
import { Logger } from '../utils/Logger';

export class ConversationVisualizer {
  private static instance: ConversationVisualizer;
  private readonly logger = Logger.getInstance();

  private constructor() {
    this.logger.debug('ConversationVisualizer initialized');
  }

  static getInstance(): ConversationVisualizer {
    if (!ConversationVisualizer.instance) {
      ConversationVisualizer.instance = new ConversationVisualizer();
    }
    return ConversationVisualizer.instance;
  }

  visualizeHistory(conversations: Conversation[]): string {
    try {
      this.logger.debug('Starting conversation history visualization');
      const grouped = this.groupByDate(conversations);
      const html = this.generateHTML(grouped);
      this.logger.debug('Conversation history visualization completed');
      return html;
    } catch (error) {
      this.logger.error('Error visualizing conversation history', error as Error);
      throw error;
    }
  }

  private groupByDate(conversations: Conversation[]): Map<string, Conversation[]> {
    const grouped = new Map<string, Conversation[]>();

    conversations.forEach((conv) => {
      const date = new Date(conv.create_time).toLocaleDateString();
      const existing = grouped.get(date) || [];
      grouped.set(date, [...existing, conv]);
    });

    return grouped;
  }

  private generateHTML(grouped: Map<string, Conversation[]>): string {
    const dates = Array.from(grouped.keys()).sort().reverse();

    return `
            <div class="history-container">
                ${dates.map((date) => this.generateDateGroup(date, grouped.get(date) || [])).join('')}
            </div>
        `;
  }

  private generateDateGroup(date: string, conversations: Conversation[]): string {
    return `
            <div class="date-group">
                <h3 class="date-header">${date}</h3>
                <div class="conversation-group">
                    ${conversations.map((conv) => this.generateConversationCard(conv)).join('')}
                </div>
            </div>
        `;
  }

  private generateConversationCard(conv: Conversation): string {
    const title = this.escapeHtml(conv.title || 'Untitled Conversation');
    const model = this.escapeHtml(conv.model || 'ChatGPT');
    const time = new Date(conv.create_time).toLocaleTimeString();

    return `
            <div class="conversation-card" data-id="${conv.id}">
                <div class="conversation-header">
                    <span class="title">${title}</span>
                    <span class="model-badge ${model.toLowerCase()}">${model}</span>
                </div>
                <div class="conversation-meta">
                    <span class="time">${time}</span>
                    ${conv.is_starred ? '<span class="star">★</span>' : ''}
                </div>
            </div>
        `;
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
