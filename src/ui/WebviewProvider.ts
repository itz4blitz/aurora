import * as vscode from 'vscode';
import { codeBlockStyles, copyScript } from './styles/codeBlock';

export class WebviewProvider {
  private static instance: WebviewProvider;

  private constructor(private readonly context: vscode.ExtensionContext) {}

  public static initialize(context: vscode.ExtensionContext): WebviewProvider {
    if (!WebviewProvider.instance) {
      WebviewProvider.instance = new WebviewProvider(context);
    }
    return WebviewProvider.instance;
  }

  public static getInstance(): WebviewProvider {
    if (!WebviewProvider.instance) {
      throw new Error('WebviewProvider must be initialized with context first');
    }
    return WebviewProvider.instance;
  }

  getWebviewContent(panel: vscode.WebviewPanel, content: string): string {
    // Get the local path to media files
    const mediaPath = vscode.Uri.joinPath(this.context.extensionUri, 'media');

    // Create URIs for resources
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaPath, 'styles.css'));
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaPath, 'main.js'));
    const codiconsUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        'node_modules',
        '@vscode/codicons',
        'dist',
        'codicon.css'
      )
    );

    // Get the CSP source
    const nonce = this.getNonce();
    const csp = this.getCSP(panel.webview, nonce);

    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="${csp}">
                <link href="${codiconsUri.toString()}" rel="stylesheet" />
                <link href="${styleUri.toString()}" rel="stylesheet" />
                <style>
                    ${codeBlockStyles}
                </style>
            </head>
            <body>
                <div class="content">
                    ${content}
                </div>
                <script nonce="${nonce}" src="${scriptUri.toString()}"></script>
                <script nonce="${nonce}">
                    ${copyScript}
                </script>
            </body>
            </html>
        `;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private getCSP(webview: vscode.Webview, nonce: string): string {
    return [
      "default-src 'none'",
      'img-src ${webview.cspSource} https: data:',
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      'font-src ${webview.cspSource}',
    ].join('; ');
  }

  dispose(): void {
    WebviewProvider.instance = null as unknown as WebviewProvider;
  }
}
