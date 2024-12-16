import * as vscode from 'vscode';
import { DiffChange } from '@/types';
import { DiffView } from '@ui/components/DiffView';
import { Message, ModelConfigWithType } from '@/types';

interface WebviewDiffMessage {
  type: 'acceptDiff' | 'rejectDiff' | 'acceptAllDiffs' | 'rejectAllDiffs';
  diffId?: number;
}

export class ChatWebview {
  private static instance: ChatWebview;
  private panel: vscode.WebviewPanel | null;
  private readonly diffView: DiffView;
  private currentDiffs: DiffChange[] = [];

  private constructor(private readonly extensionUri: vscode.Uri) {
    this.panel = vscode.window.createWebviewPanel(
      'auroraChat',
      'Aurora AI Chat',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      }
    );

    this.diffView = new DiffView(this.panel.webview, this.extensionUri);
    this.setupMessageHandling();
  }

  public static getInstance(
    extensionUri: vscode.Uri,
    _context: vscode.ExtensionContext
  ): ChatWebview {
    if (!ChatWebview.instance) {
      ChatWebview.instance = new ChatWebview(extensionUri);
    }
    return ChatWebview.instance;
  }

  private setupMessageHandling(): void {
    if (!this.panel) return;

    this.panel.webview.onDidReceiveMessage((message: WebviewDiffMessage) => {
      switch (message.type) {
        case 'acceptDiff':
          if (message.diffId !== undefined) {
            void this.handleAcceptDiff(message.diffId);
          }
          break;
        case 'rejectDiff':
          if (message.diffId !== undefined) {
            void this.handleRejectDiff(message.diffId);
          }
          break;
        case 'acceptAllDiffs':
          void this.handleAcceptAllDiffs();
          break;
        case 'rejectAllDiffs':
          void this.handleRejectAllDiffs();
          break;
      }
    });
  }

  public show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'auroraChat',
      'Aurora AI Chat',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri],
      }
    );

    this.panel.webview.html = this.getWebviewContent();
    this.setupMessageHandling();
    this.panel.onDidDispose(() => this.dispose());
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        .diff-view {
                            font-family: monospace;
                            white-space: pre;
                            margin: 10px 0;
                        }
                        .diff-added { background-color: #e6ffe6; }
                        .diff-removed { background-color: #ffe6e6; }
                        .controls { margin: 10px 0; }
                    </style>
                </head>
                <body>
                    <div id="chat-container">
                        <div id="messages"></div>
                        <div id="diff-view" class="diff-view"></div>
                        <div class="controls">
                            <button id="acceptAll">Accept All Changes</button>
                            <button id="acceptNext">Accept Next Change</button>
                            <button id="reject">Reject Changes</button>
                        </div>
                    </div>
                    <script>
                        const vscode = acquireVsCodeApi();
                        
                        document.getElementById('acceptAll').addEventListener('click', () => {
                            vscode.postMessage({ type: 'acceptAllDiffs' });
                        });
                        
                        document.getElementById('acceptNext').addEventListener('click', () => {
                            vscode.postMessage({ type: 'acceptDiff' });
                        });
                        
                        document.getElementById('reject').addEventListener('click', () => {
                            vscode.postMessage({ type: 'rejectAllDiffs' });
                        });
                    </script>
                </body>
            </html>`;
  }

  private async handleAcceptDiff(diffId: number): Promise<void> {
    const diff = this.currentDiffs[diffId];
    if (!diff) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    await editor.edit((editBuilder) => {
      editBuilder.replace(diff.range, diff.suggested);
    });

    diff.status = 'accepted';
    await this.updateDiffView();
  }

  private async handleRejectDiff(diffId: number): Promise<void> {
    const diff = this.currentDiffs[diffId];
    if (!diff) return;

    diff.status = 'rejected';
    await this.updateDiffView();
  }

  private async handleAcceptAllDiffs(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const sortedDiffs = [...this.currentDiffs].sort(
      (a, b) => b.range.start.line - a.range.start.line
    );

    await editor.edit((editBuilder) => {
      for (const diff of sortedDiffs) {
        if (diff.status === 'pending') {
          editBuilder.replace(diff.range, diff.suggested);
          diff.status = 'accepted';
        }
      }
    });

    await this.updateDiffView();
  }

  private async handleRejectAllDiffs(): Promise<void> {
    for (const diff of this.currentDiffs) {
      if (diff.status === 'pending') {
        diff.status = 'rejected';
      }
    }
    await this.updateDiffView();
  }

  private async updateDiffView(): Promise<void> {
    if (this.panel) {
      const content = this.diffView.getWebviewContent(this.currentDiffs);
      await this.panel.webview.postMessage({
        type: 'updateDiffs',
        content,
      });
    }
  }

  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }

  public getWebview(): vscode.Webview | undefined {
    return this.panel?.webview;
  }

  public async handleCommand(command: string, args?: unknown): Promise<void> {
    if (!this.panel) return;

    switch (command) {
      case 'insertSnippet':
        await this.panel.webview.postMessage({
          type: 'insertSnippet',
          text: (args as { text: string })?.text,
        });
        break;
      case 'explainCode':
        await this.panel.webview.postMessage({
          type: 'explainCode',
          text: (args as { text: string })?.text,
        });
        break;
      case 'improveCode':
        await this.panel.webview.postMessage({
          type: 'improveCode',
          text: (args as { text: string })?.text,
        });
        break;
      case 'findIssues':
        await this.panel.webview.postMessage({
          type: 'findIssues',
          text: (args as { text: string })?.text,
        });
        break;
      case 'newConversation':
        await this.panel.webview.postMessage({ type: 'newConversation' });
        break;
      case 'focusSearch':
        await this.panel.webview.postMessage({ type: 'focusSearch' });
        break;
      case 'togglePin':
        await this.panel.webview.postMessage({ type: 'togglePin' });
        break;
      case 'toggleStar':
        await this.panel.webview.postMessage({ type: 'toggleStar' });
        break;
      case 'generateCode':
        await this.panel.webview.postMessage({ type: 'generateCode' });
        break;
      case 'generateTests':
        await this.panel.webview.postMessage({ type: 'generateTests' });
        break;
      case 'switchModel': {
        const model = (args as { model: string })?.model;
        if (model) {
          await this.panel.webview.postMessage({
            type: 'switchModel',
            model,
          });
        }
        break;
      }
    }
  }

  public async restoreMessage(message: Message): Promise<void> {
    if (!this.panel) return;

    await this.panel.webview.postMessage({
      type: 'restoreMessage',
      message,
    });
  }

  public async setModelConfig(config: ModelConfigWithType): Promise<void> {
    if (!this.panel) return;

    await this.panel.webview.postMessage({
      type: 'modelConfigUpdated',
      config,
    });
  }

  public async restoreScrollPosition(position: number): Promise<void> {
    if (!this.panel) return;

    await this.panel.webview.postMessage({
      type: 'restoreScrollPosition',
      position,
    });
  }

  public async restoreInput(input: string): Promise<void> {
    if (!this.panel) return;

    await this.panel.webview.postMessage({
      type: 'restoreInput',
      input,
    });
  }
}
