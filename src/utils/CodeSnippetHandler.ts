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
  private readonly codeBlockRegex: RegExp = /```(?:(\w+)\n)?([\s\S]*?)```/g;
  private readonly languageRegex: RegExp = /^(\w+):(.*)$/;

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

  public extractSnippet(text: string): string {
    // Extract code blocks from the text
    const matches = text.match(this.codeBlockRegex);
    if (!matches) {
      return text.trim();
    }

    // Process the first code block found
    const match = matches[0];
    const withoutBackticks = match.replace(/```/g, '').trim();

    // Check for language specification
    const languageMatch = withoutBackticks.match(this.languageRegex);
    if (languageMatch) {
      // Return the code without the language specification
      return languageMatch[2].trim();
    }

    return withoutBackticks;
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
