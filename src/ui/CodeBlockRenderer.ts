import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { ErrorManager } from '../error/ErrorManager';
import { ErrorSeverity } from '../types';

export class CodeBlockRenderer {
  private static instance: CodeBlockRenderer;
  private readonly logger: Logger;
  private readonly errorManager: ErrorManager;
  private readonly supportedLanguages: Set<string>;

  private constructor() {
    this.logger = Logger.getInstance();
    this.errorManager = ErrorManager.getInstance();
    this.supportedLanguages = new Set([
      'typescript',
      'javascript',
      'python',
      'java',
      'cpp',
      'csharp',
      'go',
      'rust',
      'ruby',
      'php',
      'swift',
      'kotlin',
      'scala',
      'html',
      'css',
      'json',
      'yaml',
      'markdown',
      'sql',
      'shell',
    ]);
  }

  public static getInstance(): CodeBlockRenderer {
    if (!CodeBlockRenderer.instance) {
      CodeBlockRenderer.instance = new CodeBlockRenderer();
    }
    return CodeBlockRenderer.instance;
  }

  async renderCodeBlock(code: string, language: string): Promise<string> {
    try {
      const normalizedLang = this.normalizeLanguage(language);
      const highlightedCode = await this.highlightCode(code, normalizedLang);

      return this.wrapInHTML(highlightedCode, normalizedLang);
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'CodeBlockRenderer.renderCodeBlock',
        ErrorSeverity.Warning
      );
      return this.wrapInHTML(this.escapeHTML(code), 'plaintext');
    }
  }

  private normalizeLanguage(language: string): string {
    const normalized = language.toLowerCase().trim();

    // Handle common aliases
    const aliases: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      rb: 'ruby',
      sh: 'shell',
      bash: 'shell',
      zsh: 'shell',
      cs: 'csharp',
      yml: 'yaml',
    };

    const resolvedLang = aliases[normalized] || normalized;
    return this.supportedLanguages.has(resolvedLang) ? resolvedLang : 'plaintext';
  }

  private async highlightCode(code: string, language: string): Promise<string> {
    try {
      // Get VS Code's built-in tokenizer for the language
      const document = await this.createTempDocument(code, language);
      if (!document) {
        return this.escapeHTML(code);
      }

      const tokens = await this.tokenize(document);
      return this.convertTokensToHTML(tokens, code);
    } catch (error) {
      const errorMessage = `Failed to highlight code: ${(error as Error).message}`;
      this.logger.warn(errorMessage);
      return this.escapeHTML(code);
    }
  }

  private async createTempDocument(
    content: string,
    language: string
  ): Promise<vscode.TextDocument | null> {
    try {
      return await vscode.workspace.openTextDocument({
        content,
        language,
      });
    } catch (error) {
      const errorMessage = `Failed to create temp document: ${(error as Error).message}`;
      this.logger.warn(errorMessage);
      return null;
    }
  }

  private async tokenize(document: vscode.TextDocument): Promise<vscode.SemanticTokens> {
    const languages = await vscode.languages.getLanguages();
    const provider = languages.includes(document.languageId);

    if (!provider) {
      throw new Error(`No semantic tokens provider found for ${document.languageId}`);
    }

    return await vscode.commands.executeCommand('_executeDocumentSemanticTokens', document.uri);
  }

  private convertTokensToHTML(tokens: vscode.SemanticTokens, originalCode: string): string {
    let html = '';
    let currentPosition = 0;

    // Convert token data to spans
    const tokenData = Array.from(tokens.data);
    for (let i = 0; i < tokenData.length; i += 5) {
      // Semantic tokens data comes in groups of 5
      const length = tokenData[i + 2];
      const tokenType = tokenData[i + 3];

      const tokenText = originalCode.substr(currentPosition, length);
      currentPosition += length;

      html += `<span class="token-${tokenType}">${this.escapeHTML(tokenText)}</span>`;
    }

    // Add any remaining text
    if (currentPosition < originalCode.length) {
      html += this.escapeHTML(originalCode.substr(currentPosition));
    }

    return html;
  }

  private wrapInHTML(code: string, language: string): string {
    return `
            <div class="code-block ${language}">
                <div class="code-header">
                    <span class="language-label">${language}</span>
                    <button class="copy-button" onclick="copyCode(this)">Copy</button>
                </div>
                <pre><code class="language-${language}">${code}</code></pre>
            </div>
        `;
  }

  private escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  dispose(): void {
    CodeBlockRenderer.instance = null as unknown as CodeBlockRenderer;
  }
}
