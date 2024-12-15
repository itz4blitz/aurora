import * as vscode from 'vscode';
import { Logger } from '@utils/Logger';
import { ErrorManager } from '@error/ErrorManager';
import { ErrorSeverity } from '@/types';

export class FileIO {
    private static logger = Logger.getInstance();
    private static errorManager = ErrorManager.getInstance();

    static async readFile(uri: vscode.Uri): Promise<string> {
        try {
            const content = await vscode.workspace.fs.readFile(uri);
            return content.toString();
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'FileIO.readFile',
                ErrorSeverity.Error
            );
            throw error;
        }
    }

    static async writeFile(uri: vscode.Uri, content: string): Promise<void> {
        try {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
            this.logger.info(`File written successfully: ${uri.fsPath}`);
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'FileIO.writeFile',
                ErrorSeverity.Error
            );
            throw error;
        }
    }

    static async exists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }
} 