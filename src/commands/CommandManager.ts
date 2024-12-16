import * as vscode from 'vscode';
import { ChatWebview } from '@webview/ChatWebview';
import { ConversationManager } from '@services/ConversationManager';
import { ConfigManager } from '@config/ConfigManager';
import { ConversationIO } from '@utils/ConversationIO';
import { StatusBarManager } from '@status/StatusBarManager';
import { O1ProService } from '@services/O1ProService';
import { ErrorManager } from '@error/ErrorManager';
import { ErrorSeverity } from '@types';
import { Logger } from '@utils/Logger';
import { AIModel } from '@types';
import { Webview } from 'vscode';

interface ParsedResponse {
  content: string;
  type: string;
  timestamp: number;
  metadata: {
    language?: string;
    confidence?: number;
    model: 'o1pro';
  };
}

export class CommandManager {
  private static instance: CommandManager;
  private disposables: vscode.Disposable[] = [];
  private activeWebview?: ChatWebview;
  private statusBarManager: StatusBarManager;
  private o1proService: O1ProService;
  private errorManager: ErrorManager;
  private logger: Logger;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly conversationManager: ConversationManager,
    private readonly configManager: ConfigManager
  ) {
    this.statusBarManager = new StatusBarManager();
    this.o1proService = O1ProService.getInstance();
    this.errorManager = ErrorManager.getInstance();
    this.logger = Logger.getInstance();
  }

  static getInstance(
    context: vscode.ExtensionContext,
    conversationManager: ConversationManager,
    configManager: ConfigManager
  ): CommandManager {
    if (!CommandManager.instance) {
      CommandManager.instance = new CommandManager(context, conversationManager, configManager);
    }
    return CommandManager.instance;
  }

  registerCommands(): void {
    // Main commands
    this.register('aurora.openChat', () => this.openChat());
    this.register('aurora.toggleModel', () => this.toggleModel());
    this.register('aurora.exportConversations', () => this.exportConversations());
    this.register('aurora.importConversations', () => this.importConversations());
    this.register('aurora.newConversation', () => this.newConversation());
    this.register('aurora.searchConversations', () => this.focusSearch());
    this.register('aurora.pinConversation', () => this.togglePin());
    this.register('aurora.starConversation', () => this.toggleStar());

    // Editor context menu commands
    this.register('aurora.copySnippet', () => this.handleSnippet());
    this.register('aurora.explainCode', () => this.explainCode());
    this.register('aurora.improveCode', () => this.improveCode());
    this.register('aurora.findIssues', () => this.findIssues());

    // Register keyboard shortcuts
    this.registerKeyboardShortcuts();

    // Add new O1Pro-specific commands
    this.register('aurora.injectO1ProScript', () => this.injectO1ProScript());
    this.register('aurora.parseO1ProResponse', () => this.parseO1ProResponse());
  }

  private register(command: string, callback: () => Promise<void> | void): void {
    const disposable = vscode.commands.registerCommand(command, () => {
      void callback();
    });
    this.disposables.push(disposable);
    this.context.subscriptions.push(disposable);
  }

  private registerKeyboardShortcuts(): void {
    const shortcuts = this.configManager.getShortcuts();

    Object.entries(shortcuts).forEach(([command]) => {
      const disposable = vscode.commands.registerCommand(`aurora.${command}`, () => {
        void this.handleShortcut(command);
      });
      this.context.subscriptions.push(disposable);
    });
  }

  private async handleShortcut(command: string): Promise<void> {
    if (!this.activeWebview) {
      this.openChat();
    }

    if (this.activeWebview) {
      await this.activeWebview.handleCommand(command);
      this.statusBarManager.update(command);
    }
  }

  private openChat(): void {
    if (!this.activeWebview) {
      this.activeWebview = ChatWebview.getInstance(this.context.extensionUri, this.context);
      this.activeWebview.show();
      this.statusBarManager.show();
    } else {
      this.activeWebview.show();
    }
  }

  private async toggleModel(): Promise<void> {
    const currentModel = await this.configManager.getDefaultModel();
    const modelSequence: AIModel[] = [
      'gpt-3.5-turbo',
      'gpt-4',
      'gemini-pro',
      'claude-3-sonnet',
      'o1pro',
    ];

    const currentIndex = modelSequence.indexOf(currentModel);
    const nextModel = modelSequence[(currentIndex + 1) % modelSequence.length];

    await this.configManager.updateDefaultModel(nextModel);

    if (this.activeWebview) {
      await this.activeWebview.handleCommand('switchModel', { model: nextModel });
      this.statusBarManager.updateModel(nextModel);
    }
  }

  private async exportConversations(): Promise<void> {
    try {
      const conversations = await this.conversationManager.fetchConversations();
      await ConversationIO.exportConversations(conversations);
      void vscode.window.showInformationMessage('Conversations exported successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Failed to export conversations: ${errorMessage}`);
    }
  }

  private async importConversations(): Promise<void> {
    try {
      const conversations = await ConversationIO.importConversations();
      for (const conversation of conversations) {
        await this.conversationManager.sendMessage(
          conversation.messages[0].content,
          conversation.model === 'gemini' ? 'gemini' : 'chatgpt'
        );
      }
      void vscode.window.showInformationMessage(`Imported ${conversations.length} conversations`);
    } catch (error) {
      await this.errorManager.handleError(
        error instanceof Error ? error : new Error(String(error)),
        'CommandManager.importConversations',
        ErrorSeverity.Error
      );
      void vscode.window.showErrorMessage(`Failed to import conversations: ${String(error)}`);
    }
  }

  private async handleSnippet(): Promise<void> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (editor && this.activeWebview) {
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        const webview = this.activeWebview.getWebview();

        if (webview) {
          const currentModel = await this.configManager.getDefaultModel();
          if (currentModel.startsWith('gpt-')) {
            await this.o1proService.injectScrapingScript(webview);
          }
        }

        await this.activeWebview.handleCommand('insertSnippet', { text });
      }
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'CommandManager.handleSnippet',
        ErrorSeverity.Error
      );
    }
  }

  private async explainCode(): Promise<void> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (editor && this.activeWebview) {
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        const webview = this.activeWebview.getWebview() as Webview;

        if (webview) {
          const currentModel = await this.configManager.getDefaultModel();
          if (currentModel.startsWith('gpt-')) {
            await this.o1proService.injectScrapingScript(webview);
            this.logger.info('Injected O1Pro scraping script for code explanation');
          }
        }

        await this.activeWebview.handleCommand('explainCode', { text });
      }
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'CommandManager.explainCode',
        ErrorSeverity.Error
      );
    }
  }

  private async improveCode(): Promise<void> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (editor && this.activeWebview) {
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        const webview = this.activeWebview.getWebview() as Webview;

        if (webview) {
          const currentModel = await this.configManager.getDefaultModel();
          if (currentModel.startsWith('gpt-')) {
            await this.o1proService.injectScrapingScript(webview);
            this.logger.info('Injected O1Pro scraping script for code improvement');
          }
        }

        await this.activeWebview.handleCommand('improveCode', { text });
      }
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'CommandManager.improveCode',
        ErrorSeverity.Error
      );
    }
  }

  private async findIssues(): Promise<void> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (editor && this.activeWebview) {
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        const webview = this.activeWebview.getWebview() as Webview;

        if (webview) {
          const currentModel = await this.configManager.getDefaultModel();
          if (currentModel.startsWith('gpt-')) {
            await this.o1proService.injectScrapingScript(webview);
            this.logger.info('Injected O1Pro scraping script for issue finding');
          }
        }

        await this.activeWebview.handleCommand('findIssues', { text });
      }
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'CommandManager.findIssues',
        ErrorSeverity.Error
      );
    }
  }

  private newConversation(): void {
    void this.activeWebview?.handleCommand('newConversation');
  }

  private focusSearch(): void {
    void this.activeWebview?.handleCommand('focusSearch');
  }

  private togglePin(): void {
    void this.activeWebview?.handleCommand('togglePin');
  }

  private toggleStar(): void {
    void this.activeWebview?.handleCommand('toggleStar');
  }

  private async injectO1ProScript(): Promise<void> {
    try {
      if (this.activeWebview) {
        const webview = this.activeWebview.getWebview() as Webview;
        if (webview) {
          const currentModel = await this.configManager.getDefaultModel();
          if (currentModel.startsWith('gpt-')) {
            await this.o1proService.injectScrapingScript(webview);
            this.logger.info('Manually injected O1Pro scraping script');
          }
        }
      }
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'CommandManager.injectO1ProScript',
        ErrorSeverity.Error
      );
    }
  }

  private async parseO1ProResponse(): Promise<void> {
    try {
      if (this.activeWebview) {
        const webview = this.activeWebview.getWebview() as Webview;
        if (webview) {
          const currentModel = await this.configManager.getDefaultModel();
          if (currentModel.startsWith('gpt-')) {
            const scrapedResponse = await this.o1proService.parseResponse(webview);

            if (!scrapedResponse) {
              throw new Error('Failed to parse O1Pro response');
            }

            const parsedResponse: ParsedResponse = {
              content: `${scrapedResponse.code}\n\n${scrapedResponse.explanation}`,
              type: 'code',
              timestamp: Date.now(),
              metadata: {
                model: 'o1pro',
              },
            };

            this.logger.info(
              'Parsed O1Pro response: ' +
                JSON.stringify({
                  content: parsedResponse.content,
                  type: parsedResponse.type,
                  timestamp: parsedResponse.timestamp,
                })
            );
          }
        }
      }
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'CommandManager.parseO1ProResponse',
        ErrorSeverity.Error
      );
    }
  }

  dispose(): void {
    this.disposables.forEach((disposable: vscode.Disposable): void => {
      disposable.dispose();
    });
    this.statusBarManager.dispose();
  }
}
