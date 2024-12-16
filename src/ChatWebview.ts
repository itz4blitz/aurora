import * as vscode from 'vscode';
import { AIModel, ScrapedResponse, DiffChange, WebviewMessage, ModelConfigWithType } from '@types';
import { DiffView } from '@ui/components/DiffView';
import { DiffService } from '@services/DiffService';
import { Logger } from '@utils/Logger';

interface WebviewDiffMessage {
  type: 'acceptDiff' | 'rejectDiff' | 'acceptAllDiffs' | 'rejectAllDiffs';
  diffId?: number;
}

export class ChatWebview {
  private static instance: ChatWebview;
  private panel: vscode.WebviewPanel | null = null;
  private readonly iframe: HTMLIFrameElement;
  private currentModelConfig: ModelConfigWithType;
  private observer: MutationObserver | undefined;
  private pendingChanges: DiffChange[] = [];
  private currentChangeIndex = 0;
  private diffView!: DiffView;
  private diffService: DiffService;
  private currentDiffs: DiffChange[] = [];
  private readonly logger = Logger.getInstance();

  private constructor(private readonly extensionUri: vscode.Uri) {
    this.currentModelConfig = {
      type: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
    };

    this.iframe = document.createElement('iframe');
    this.iframe.id = 'o1pro-iframe';
    this.iframe.style.width = '100%';
    this.iframe.style.height = '100%';

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
    this.diffService = DiffService.getInstance();

    this.setupDiffMessageHandling();
    this.setupIframeObserver();
  }

  private setupIframeObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
          void this.handleIframeSourceChange();
        }
      });
    });

    if (this.iframe) {
      this.observer.observe(this.iframe, {
        attributes: true,
        attributeFilter: ['src'],
      });
    }
  }

  private async handleIframeSourceChange(): Promise<void> {
    if (this.iframe.src && this.currentModelConfig.type === 'o1pro') {
      if (this.panel?.webview) {
        await this.panel.webview.postMessage({
          type: 'iframeSourceChanged',
          src: this.iframe.src,
        });
      }
    }
  }

  public static getInstance(extensionUri: vscode.Uri): ChatWebview {
    if (!ChatWebview.instance) {
      ChatWebview.instance = new ChatWebview(extensionUri);
    }
    return ChatWebview.instance;
  }

  public getWebview(): vscode.Webview | undefined {
    return this.panel?.webview;
  }

  public async handleCommand(command: string, payload: unknown): Promise<void> {
    switch (command) {
      case 'switchModel':
        await this.handleModelSwitch(payload as AIModel);
        break;
      case 'sendMessage':
        await this.handleO1ProResponse(payload as ScrapedResponse);
        break;
      case 'clearChat':
        await this.rejectChanges();
        break;
      case 'acceptDiff':
        if (typeof payload === 'number') {
          await this.handleAcceptDiff(payload);
        }
        break;
      case 'rejectDiff':
        if (typeof payload === 'number') {
          await this.handleRejectDiff(payload);
        }
        break;
      case 'acceptAllDiffs':
        await this.handleAcceptAllDiffs();
        break;
      case 'rejectAllDiffs':
        await this.handleRejectAllDiffs();
        break;
      default:
        this.logger.warn(`Unhandled command: ${command}`);
        break;
    }
  }

  private getWebviewContent(): string {
    return `
            <!DOCTYPE html>
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
                        #modelSwitch { margin-bottom: 10px; }
                        #o1pro-container { 
                            width: 100%;
                            height: 600px;
                            display: none;
                        }
                    </style>
                </head>
                <body>
                    <div id="modelSwitch">
                        <select id="modelSelect">
                            <option value="o1pro">O1 Pro</option>
                            <option value="gemini">Gemini</option>
                        </select>
                    </div>
                    
                    <div id="o1pro-container">
                        <iframe id="o1pro-iframe" style="width: 100%; height: 100%;"></iframe>
                    </div>

                    <div id="chat-container">
                        <div id="messages"></div>
                        <div id="suggestions"></div>
                        <div id="diff-view" class="diff-view"></div>
                        <div class="controls">
                            <button id="acceptAll">Accept All Changes</button>
                            <button id="acceptNext">Accept Next Change</button>
                            <button id="reject">Reject Changes</button>
                        </div>
                    </div>

                    <script>
                        (function() {
                            const vscode = acquireVsCodeApi();
                            let currentChanges = [];
                            
                            document.getElementById('modelSelect').addEventListener('change', (e) => {
                                const model = e.target.value;
                                vscode.postMessage({ 
                                    type: 'switchModel', 
                                    model: model 
                                });
                                toggleO1ProContainer(model === 'o1pro');
                            });

                            function updateDiffView(diff) {
                                const diffView = document.getElementById('diff-view');
                                const html = \`
                                    <div class="diff-header">
                                        Change \${diff.index + 1} of \${diff.total}
                                    </div>
                                    <div class="diff-content">
                                        <div class="diff-removed">\${escapeHtml(diff.original)}</div>
                                        <div class="diff-added">\${escapeHtml(diff.suggested)}</div>
                                    </div>
                                \`;
                                diffView.innerHTML = html;
                            }

                            function escapeHtml(unsafe) {
                                return unsafe
                                    .replace(/&/g, "&amp;")
                                    .replace(/</g, "&lt;")
                                    .replace(/>/g, "&gt;")
                                    .replace(/"/g, "&quot;")
                                    .replace(/'/g, "&#039;");
                            }

                            window.addEventListener('message', event => {
                                const message = event.data;
                                switch (message.type) {
                                    case 'showDiff':
                                        updateDiffView(message.diff);
                                        break;
                                    case 'updateChanges':
                                        currentChanges = message.changes;
                                        break;
                                }
                            });

                            document.getElementById('acceptAll').addEventListener('click', () => {
                                vscode.postMessage({ type: 'acceptAllChanges' });
                            });

                            document.getElementById('acceptNext').addEventListener('click', () => {
                                vscode.postMessage({ type: 'acceptNextChange' });
                            });

                            document.getElementById('reject').addEventListener('click', () => {
                                vscode.postMessage({ type: 'rejectChanges' });
                            });
                        })();
                    </script>
                </body>
            </html>
        `;
  }

  private setupMessageHandling(): void {
    if (!this.panel) return;

    this.panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
      void this.handleMessage(message);
    });
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'switchModel':
        if (message.model) {
          await this.handleModelSwitch(message.model);
        } else {
          this.logger.warn('Received switchModel message without model');
        }
        break;
      case 'o1proResponse':
        if (message.response) {
          await this.handleO1ProResponse(message.response);
        } else {
          this.logger.warn('Received o1proResponse message without response data');
        }
        break;
      case 'acceptAllChanges':
        await this.acceptAllChanges();
        break;
      case 'acceptNextChange':
        await this.acceptNextChange();
        break;
      case 'rejectChanges':
        await this.rejectChanges();
        break;
    }
  }

  private async handleModelSwitch(model: AIModel): Promise<void> {
    this.currentModelConfig = {
      type: model,
      temperature: 0.7,
      maxTokens: model === 'gpt-4' ? 8192 : 4096,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
    };

    if (this.panel) {
      await this.panel.webview.postMessage({
        type: 'modelSwitched',
        model: model,
        config: this.currentModelConfig,
      });
    }

    if (model === 'o1pro') {
      this.iframe.src = 'https://o1pro.example.com';
    }

    await vscode.commands.executeCommand('aiAssistant.modelSwitched', model);
  }

  private async handleO1ProResponse(response: ScrapedResponse): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const selection = editor.selection;
    const originalText = document.getText(selection);

    if (!response || typeof response !== 'object') {
      this.logger.error('Invalid response received');
      return;
    }

    const suggestedCode = typeof response.text === 'string' ? response.text : '';

    const diffs = this.generateDiffs(originalText, suggestedCode);
    this.pendingChanges = diffs.map((diff) => ({
      original: diff.original,
      suggested: diff.suggested,
      range: new vscode.Range(
        document.positionAt(diff.startOffset),
        document.positionAt(diff.endOffset)
      ),
      status: 'pending',
    }));

    await this.showCurrentDiff();
  }

  private generateDiffs(
    original: string,
    suggested: string
  ): Array<{
    original: string;
    suggested: string;
    startOffset: number;
    endOffset: number;
  }> {
    // Simple line-by-line diff for now
    const originalLines = original.split('\n');
    const suggestedLines = suggested.split('\n');
    const diffs: Array<{
      original: string;
      suggested: string;
      startOffset: number;
      endOffset: number;
    }> = [];

    let offset = 0;
    for (let i = 0; i < Math.max(originalLines.length, suggestedLines.length); i++) {
      const originalLine = originalLines[i] || '';
      const suggestedLine = suggestedLines[i] || '';

      if (originalLine !== suggestedLine) {
        diffs.push({
          original: originalLine,
          suggested: suggestedLine,
          startOffset: offset,
          endOffset: offset + Math.max(originalLine.length, suggestedLine.length),
        });
      }
      offset += originalLine.length + 1; // +1 for newline
    }

    return diffs;
  }

  private async showCurrentDiff(): Promise<void> {
    if (this.pendingChanges.length === 0) return;

    const currentDiff = this.pendingChanges[this.currentChangeIndex];

    // Highlight the current change in the editor
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.setDecorations(this.getDiffDecoration(), [currentDiff.range]);
    }

    // Update webview with current diff
    if (this.panel) {
      await this.panel.webview.postMessage({
        type: 'showDiff',
        diff: {
          original: currentDiff.original,
          suggested: currentDiff.suggested,
          index: this.currentChangeIndex,
          total: this.pendingChanges.length,
        },
      });
    }
  }

  private getDiffDecoration(): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
      border: '1px solid',
      borderColor: new vscode.ThemeColor('diffEditor.insertedTextBorder'),
    });
  }

  private async acceptAllChanges(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Apply all changes in reverse order to maintain correct positions
    const sortedChanges = [...this.pendingChanges].sort(
      (a, b) => b.range.start.line - a.range.start.line
    );

    await editor.edit((editBuilder) => {
      for (const change of sortedChanges) {
        editBuilder.replace(change.range, change.suggested);
        change.status = 'accepted';
      }
    });

    // Clear pending changes
    this.pendingChanges = [];
    this.currentChangeIndex = 0;

    if (this.panel) {
      await this.panel.webview.postMessage({
        type: 'changesApplied',
        remaining: 0,
      });
    }
  }

  private async acceptNextChange(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || this.currentChangeIndex >= this.pendingChanges.length) return;

    const currentChange = this.pendingChanges[this.currentChangeIndex];

    await editor.edit((editBuilder) => {
      editBuilder.replace(currentChange.range, currentChange.suggested);
      currentChange.status = 'accepted';
    });

    this.currentChangeIndex++;

    if (this.currentChangeIndex < this.pendingChanges.length) {
      await this.showCurrentDiff();
    } else {
      if (this.panel) {
        await this.panel.webview.postMessage({
          type: 'changesApplied',
          remaining: 0,
        });
      }
    }
  }

  private async rejectChanges(): Promise<void> {
    // Clear all pending changes
    this.pendingChanges = [];
    this.currentChangeIndex = 0;

    // Clear decorations
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.setDecorations(this.getDiffDecoration(), []);
    }

    if (this.panel) {
      await this.panel.webview.postMessage({
        type: 'changesRejected',
      });
    }
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

  private dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupDiffMessageHandling(): void {
    if (!this.panel?.webview) return;

    this.panel.webview.onDidReceiveMessage((message: WebviewDiffMessage) => {
      void this.handleDiffMessage(message);
    });
  }

  private async handleDiffMessage(message: WebviewDiffMessage): Promise<void> {
    switch (message.type) {
      case 'acceptDiff':
        if (typeof message.diffId === 'number') {
          await this.handleAcceptDiff(message.diffId);
        }
        break;
      case 'rejectDiff':
        if (typeof message.diffId === 'number') {
          await this.handleRejectDiff(message.diffId);
        }
        break;
      case 'acceptAllDiffs':
        await this.handleAcceptAllDiffs();
        break;
      case 'rejectAllDiffs':
        await this.handleRejectAllDiffs();
        break;
    }
  }

  public async showDiffs(original: string, suggested: string): Promise<void> {
    this.currentDiffs = await this.diffService.computeDiffs(original, suggested);
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

    // Apply changes in reverse order to maintain correct positions
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

  // ... implement other diff-related methods
}
