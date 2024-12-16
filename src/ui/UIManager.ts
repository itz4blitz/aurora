import * as vscode from 'vscode';
import { Logger } from '@utils/Logger';
import { ErrorManager } from '@error/ErrorManager';
import { StatusService } from '@services/StatusService';
import { IncrementalCodeView } from '@ui/IncrementalCodeView';
import { ErrorSeverity } from '@/types';

interface WebviewMessage {
  command: string;
  data?: unknown;
}

type MessageHandler = (message: WebviewMessage) => Promise<void>;

export class UIManager {
  private static instance: UIManager;
  private readonly logger: Logger;
  private readonly errorManager: ErrorManager;
  private readonly statusService: StatusService;
  private readonly incrementalView: IncrementalCodeView;

  private constructor(private readonly context: vscode.ExtensionContext) {
    this.logger = Logger.getInstance();
    this.errorManager = ErrorManager.getInstance();
    this.statusService = StatusService.getInstance();
    this.incrementalView = IncrementalCodeView.getInstance();
  }

  public static initialize(context: vscode.ExtensionContext): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager(context);
    }
    return UIManager.instance;
  }

  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      throw new Error('UIManager must be initialized with context first');
    }
    return UIManager.instance;
  }

  async showCodeSuggestion(code: string, language: string): Promise<void> {
    try {
      void this.statusService.showProgress('Rendering code suggestion', async () => {
        await this.incrementalView.show(code, language);
      });
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'UIManager.showCodeSuggestion',
        ErrorSeverity.Error
      );
      this.logger.error(`Failed to show code suggestion: ${(error as Error).message}`);
    }
  }

  showLoadingIndicator(message: string): void {
    this.statusService.showStatusBarMessage(message);
  }

  hideLoadingIndicator(): void {
    this.statusService.showStatusBarMessage('');
  }

  async showError(error: Error): Promise<void> {
    this.logger.error(error.message);
    await this.statusService.showErrorMessage(error.message);
  }

  async showSuccess(message: string): Promise<void> {
    this.logger.info(message);
    await this.statusService.showInformationMessage(message);
  }

  async promptForConfirmation(message: string): Promise<boolean> {
    const result = await vscode.window.showInformationMessage(
      message,
      { modal: true },
      'Yes',
      'No'
    );
    return result === 'Yes';
  }

  async showDiff(original: string, modified: string): Promise<void> {
    try {
      const originalDoc = await vscode.workspace.openTextDocument({
        content: original,
      });
      const modifiedDoc = await vscode.workspace.openTextDocument({
        content: modified,
      });

      await vscode.commands.executeCommand(
        'vscode.diff',
        originalDoc.uri,
        modifiedDoc.uri,
        'Code Changes'
      );
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'UIManager.showDiff',
        ErrorSeverity.Error
      );
      this.logger.error(`Failed to show diff: ${(error as Error).message}`);
    }
  }

  registerWebviewMessageHandlers(handlers: Record<string, MessageHandler>): void {
    Object.entries(handlers).forEach(([command, handler]) => {
      this.context.subscriptions.push(
        vscode.window.registerWebviewPanelSerializer(command, {
          deserializeWebviewPanel(
            webviewPanel: vscode.WebviewPanel,
            _state: unknown
          ): Thenable<void> {
            webviewPanel.webview.onDidReceiveMessage((rawMessage: unknown) => {
              const message = rawMessage as WebviewMessage;
              if (message.command === command) {
                void handler(message);
              }
            });
            return Promise.resolve();
          },
        })
      );
    });
  }

  async updateTheme(): Promise<void> {
    try {
      // Trigger theme update in all UI components
      await this.incrementalView.show('', ''); // Refresh current view
      this.logger.info('Theme updated successfully');
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'UIManager.updateTheme',
        ErrorSeverity.Error
      );
      this.logger.error(`Failed to update theme: ${(error as Error).message}`);
    }
  }

  dispose(): void {
    this.logger.info('Disposing UIManager');
    this.statusService.dispose();
    this.incrementalView.dispose();
    UIManager.instance = null as unknown as UIManager;
  }
}
