import * as vscode from 'vscode';
import { BaseViewProvider } from '@/ui/views/BaseViewProvider';
import { getNonce } from '@/utils/getNonce';

interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface WebviewMessage {
  command: 'sendMessage' | 'loadHistory';
  text?: string;
}

export class ChatViewProvider extends BaseViewProvider {
  public static readonly viewType = 'auroraChat';
  private messages: ChatMessage[] = [];

  constructor(context: vscode.ExtensionContext) {
    super(context, ChatViewProvider.viewType);
  }

  protected getHtmlContent(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'styles', 'chat.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'media', 'scripts', 'chat.js')
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
                <title>Aurora Chat</title>
            </head>
            <body>
                <div class="chat-container">
                    <div id="messages" class="messages"></div>
                    <div class="input-container">
                        <textarea id="userInput" placeholder="Type your message..."></textarea>
                        <button id="sendButton">Send</button>
                    </div>
                </div>
                <script nonce="${nonce}" src="${scriptUri.toString()}"></script>
            </body>
            </html>
        `;
  }

  protected setWebviewMessageListener(webview: vscode.Webview): void {
    webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        switch (message.command) {
          case 'sendMessage':
            if (message.text) {
              try {
                await this.handleSendMessage(message.text);
              } catch (error) {
                void vscode.window.showErrorMessage(
                  `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
              }
            }
            break;
          case 'loadHistory':
            try {
              await this.handleLoadHistory();
            } catch (error) {
              void vscode.window.showErrorMessage(
                `Failed to load history: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  private async handleSendMessage(text: string): Promise<void> {
    const userMessage: ChatMessage = {
      type: 'user',
      content: text,
      timestamp: Date.now(),
    };

    this.messages.push(userMessage);
    await this.updateChatView();

    // TODO: Implement AI response handling
    const assistantMessage: ChatMessage = {
      type: 'assistant',
      content: 'This is a placeholder response.',
      timestamp: Date.now(),
    };

    this.messages.push(assistantMessage);
    await this.updateChatView();
  }

  private async handleLoadHistory(): Promise<void> {
    // TODO: Implement chat history loading
    await this.updateChatView();
  }

  private async updateChatView(): Promise<void> {
    if (this._view) {
      await this._view.webview.postMessage({
        type: 'updateChat',
        messages: this.messages,
      });
    }
  }
}
