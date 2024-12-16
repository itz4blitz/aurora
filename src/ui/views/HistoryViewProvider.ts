import * as vscode from 'vscode';
import { BaseViewProvider } from '@/ui/views/BaseViewProvider';
import { getNonce } from '@/utils/getNonce';

interface Conversation {
  id: string;
  title: string;
  timestamp: number;
  preview: string;
}

interface HistoryMessage {
  command: 'loadConversation' | 'deleteConversation' | 'refreshHistory';
  conversationId?: string;
}

export class HistoryViewProvider extends BaseViewProvider {
  public static readonly viewType = 'auroraHistory';
  private conversations: Conversation[] = [];

  constructor(context: vscode.ExtensionContext) {
    super(context, HistoryViewProvider.viewType);
  }

  protected getHtmlContent(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'styles', 'history.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'media', 'scripts', 'history.js')
    );
    const nonce = getNonce();

    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource.toString()}; script-src 'nonce-${nonce}';">
                <link href="${styleUri.toString()}" rel="stylesheet">
                <title>Chat History</title>
            </head>
            <body>
                <div class="history-container">
                    <div id="historyList" class="history-list"></div>
                </div>
                <script nonce="${nonce}" src="${scriptUri.toString()}"></script>
            </body>
            </html>
        `;
  }

  protected setWebviewMessageListener(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(
      async (message: HistoryMessage) => {
        try {
          switch (message.command) {
            case 'loadConversation':
              if (message.conversationId) {
                await this.loadConversation(message.conversationId);
              }
              break;
            case 'deleteConversation':
              if (message.conversationId) {
                await this.deleteConversation(message.conversationId);
              }
              break;
            case 'refreshHistory':
              await this.refreshHistory();
              break;
          }
        } catch (error) {
          void vscode.window.showErrorMessage(
            `History operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  private async loadConversation(conversationId: string): Promise<void> {
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    await vscode.commands.executeCommand('aurora.openChat', { conversationId });
  }

  private async deleteConversation(conversationId: string): Promise<void> {
    const index = this.conversations.findIndex((c) => c.id === conversationId);
    if (index === -1) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    this.conversations.splice(index, 1);
    await this.saveConversations();
    await this.updateView();
  }

  private async refreshHistory(): Promise<void> {
    await this.loadConversations();
    await this.updateView();
  }

  private async loadConversations(): Promise<void> {
    const storageKey = 'aurora.conversations';
    this.conversations = await Promise.resolve(
      this.context.globalState.get<Conversation[]>(storageKey) || []
    );
  }

  private async saveConversations(): Promise<void> {
    const storageKey = 'aurora.conversations';
    await this.context.globalState.update(storageKey, this.conversations);
  }

  private async updateView(): Promise<void> {
    if (this._view) {
      await this._view.webview.postMessage({
        type: 'updateHistory',
        conversations: this.conversations,
      });
    }
  }

  public async addConversation(conversation: Conversation): Promise<void> {
    this.conversations.unshift(conversation);
    await this.saveConversations();
    await this.updateView();
  }
}
