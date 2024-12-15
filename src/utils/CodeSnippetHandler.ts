import * as vscode from 'vscode';
import { Logger } from './Logger';

export interface CodeSnippet {
    code: string;
    language: string;
    path?: string;
    range?: vscode.Range;
}

export class CodeSnippetHandler {
    private static instance: CodeSnippetHandler;
    private readonly logger = Logger.getInstance();

    private constructor() {}

    static getInstance(): CodeSnippetHandler {
        if (!CodeSnippetHandler.instance) {
            CodeSnippetHandler.instance = new CodeSnippetHandler();
        }
        return CodeSnippetHandler.instance;
    }

    async insertSnippet(snippet: CodeSnippet): Promise<boolean> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                throw new Error('No active editor');
            }

            const formattedSnippet = new vscode.SnippetString(snippet.code);
            await editor.insertSnippet(formattedSnippet);
            
            this.logger.info(`Inserted code snippet of language: ${snippet.language}`);
            return true;
        } catch (error) {
            this.logger.error('Error inserting code snippet', error as Error);
            return false;
        }
    }

    async extractSnippet(editor: vscode.TextEditor, selection: vscode.Selection): Promise<CodeSnippet> {
        try {
            const document = editor.document;
            const code = document.getText(selection);
            const language = document.languageId;
            
            return {
                code,
                language,
                path: document.uri.fsPath,
                range: selection
            };
        } catch (error) {
            this.logger.error('Error extracting code snippet', error as Error);
            throw error;
        }
    }

    formatForChat(snippet: CodeSnippet): string {
        return `\`\`\`${snippet.language}\n${snippet.code}\n\`\`\``;
    }

    async copyToClipboard(snippet: CodeSnippet): Promise<void> {
        try {
            await vscode.env.clipboard.writeText(snippet.code);
            this.logger.info('Code snippet copied to clipboard');
        } catch (error) {
            this.logger.error('Error copying to clipboard', error as Error);
            throw error;
        }
    }

    getLanguageIcon(language: string): string {
        const iconMap: { [key: string]: string } = {
            typescript: '$(symbol-class)',
            javascript: '$(symbol-method)',
            python: '$(symbol-misc)',
            java: '$(symbol-package)',
            cpp: '$(symbol-struct)',
            csharp: '$(symbol-namespace)',
            // Add more mappings as needed
        };
        return iconMap[language.toLowerCase()] || '$(symbol-file)';
    }
} 