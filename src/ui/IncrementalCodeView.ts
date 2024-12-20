import * as vscode from 'vscode';
import { Logger } from '@utils/Logger';
import { ErrorManager } from '@error/ErrorManager';
import { CodeBlockRenderer } from '@ui/CodeBlockRenderer';
import { WebviewProvider } from '@ui/WebviewProvider';
import { StatusService } from '@services/StatusService';
import { ErrorSeverity } from '@/types';

interface WebviewMessage {
  command: 'acceptCode' | 'rejectCode' | 'modifyCode';
  code?: string;
}

export class IncrementalCodeView {
  private static instance: IncrementalCodeView;
  private readonly logger: Logger;
  private readonly errorManager: ErrorManager;
  private readonly codeRenderer: CodeBlockRenderer;
  private readonly webviewProvider: WebviewProvider;
  private readonly statusService: StatusService;
  private panel: vscode.WebviewPanel | undefined;

  private constructor() {
    this.logger = Logger.getInstance();
    this.errorManager = ErrorManager.getInstance();
    this.codeRenderer = CodeBlockRenderer.getInstance();
    this.webviewProvider = WebviewProvider.getInstance();
    this.statusService = StatusService.getInstance();
  }

  public static getInstance(): IncrementalCodeView {
    if (!IncrementalCodeView.instance) {
      IncrementalCodeView.instance = new IncrementalCodeView();
    }
    return IncrementalCodeView.instance;
  }

  async show(suggestedCode: string, language: string): Promise<void> {
    try {
      if (!this.panel) {
        this.panel = vscode.window.createWebviewPanel(
          'codeReview',
          'Code Review',
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        this.panel.onDidDispose(() => {
          this.panel = undefined;
        });

        this.setupMessageHandling();
      }

      const renderedCode = await this.codeRenderer.renderCodeBlock(suggestedCode, language);
      const content = this.createReviewContent(renderedCode);
      this.panel.webview.html = this.webviewProvider.getWebviewContent(this.panel, content);
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'IncrementalCodeView.show',
        ErrorSeverity.Error
      );
      const errorMessage = `Failed to show code review: ${(error as Error).message}`;
      this.logger.error(errorMessage);
      await this.statusService.showErrorMessage(errorMessage);
    }
  }

  private setupMessageHandling(): void {
    if (!this.panel) return;

    this.panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      try {
        switch (message.command) {
          case 'acceptCode':
            if (message.code) {
              await this.handleCodeAcceptance(message.code);
            }
            break;
          case 'rejectCode':
            await this.handleCodeRejection();
            break;
          case 'modifyCode':
            if (message.code) {
              await this.handleCodeModification(message.code);
            }
            break;
        }
      } catch (error) {
        await this.errorManager.handleError(
          error as Error,
          'IncrementalCodeView.setupMessageHandling',
          ErrorSeverity.Error
        );
        const errorMessage = `Failed to handle code action: ${(error as Error).message}`;
        this.logger.error(errorMessage);
        await this.statusService.showErrorMessage(errorMessage);
      }
    });
  }

  private createReviewContent(renderedCode: string): string {
    return `
            <div class="review-container">
                <div class="code-section">
                    ${renderedCode}
                </div>
                <div class="action-bar">
                    <button class="action-button accept" onclick="acceptCode()">
                        Accept
                    </button>
                    <button class="action-button modify" onclick="showModifyDialog()">
                        Modify
                    </button>
                    <button class="action-button reject" onclick="rejectCode()">
                        Reject
                    </button>
                </div>
                <div id="modifyDialog" class="modify-dialog hidden">
                    <textarea id="modifyInput"></textarea>
                    <div class="dialog-actions">
                        <button onclick="submitModification()">Save</button>
                        <button onclick="cancelModification()">Cancel</button>
                    </div>
                </div>
            </div>
        `;
  }

  private async handleCodeAcceptance(code: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    await editor.edit((editBuilder) => {
      editBuilder.replace(editor.selection, code);
    });

    await this.statusService.showInformationMessage('Code accepted and inserted');
  }

  private async handleCodeRejection(): Promise<void> {
    await this.statusService.showInformationMessage('Code suggestion rejected');
  }

  private async handleCodeModification(code: string): Promise<void> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const document = await vscode.workspace.openTextDocument({
        content: code,
        language: editor.document.languageId,
      });

      await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.Active,
        preview: true,
      });

      const result = await new Promise<string | undefined>((resolve) => {
        const disposable = vscode.workspace.onDidSaveTextDocument((doc) => {
          if (doc === document) {
            resolve(doc.getText());
            disposable.dispose();
          }
        });

        const closeDisposable = vscode.workspace.onDidCloseTextDocument((doc) => {
          if (doc === document) {
            resolve(undefined);
            closeDisposable.dispose();
            disposable.dispose();
          }
        });
      });

      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

      if (result) {
        await this.handleCodeAcceptance(result);
      }
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'IncrementalCodeView.handleCodeModification',
        ErrorSeverity.Error
      );
      throw error;
    }
  }

  dispose(): void {
    this.panel?.dispose();
    IncrementalCodeView.instance = null as unknown as IncrementalCodeView;
  }
}
