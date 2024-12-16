import * as vscode from 'vscode';

export abstract class BaseViewProvider implements vscode.WebviewViewProvider {
  protected _view?: vscode.WebviewView;

  constructor(
    protected readonly context: vscode.ExtensionContext,
    protected readonly viewType: string
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);
    this.setWebviewMessageListener(webviewView.webview);
  }

  protected abstract getHtmlContent(webview: vscode.Webview): string;
  protected abstract setWebviewMessageListener(webview: vscode.Webview): void;
}
