import * as vscode from 'vscode';
import { Conversation } from '@/types';
import { Logger } from '@utils/Logger';
import { ErrorManager } from '@error/ErrorManager';
import { ErrorSeverity } from '@/types';

export class ConversationIO {
    private static logger = Logger.getInstance();
    private static errorManager = ErrorManager.getInstance();

    static async exportConversations(conversations: Conversation[]): Promise<void> {
        try {
            const options: vscode.SaveDialogOptions = {
                defaultUri: vscode.Uri.file('aurora_conversations.json'),
                filters: {
                    'JSON files': ['json']
                }
            };

            const uri = await vscode.window.showSaveDialog(options);
            if (!uri) return;

            const jsonContent = JSON.stringify(conversations, null, 2);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(jsonContent, 'utf-8'));
            
            this.logger.info(`Exported ${conversations.length} conversations`);
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConversationIO.exportConversations',
                ErrorSeverity.Error
            );
            throw error;
        }
    }

    static async importConversations(): Promise<Conversation[]> {
        try {
            const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                filters: {
                    'JSON files': ['json']
                }
            };

            const uris = await vscode.window.showOpenDialog(options);
            if (!uris || uris.length === 0) {
                return [];
            }

            const fileContent = await vscode.workspace.fs.readFile(uris[0]);
            const conversations = JSON.parse(fileContent.toString()) as Conversation[];
            
            this.logger.info(`Imported ${conversations.length} conversations`);
            return conversations;
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'ConversationIO.importConversations',
                ErrorSeverity.Error
            );
            throw error;
        }
    }
} 