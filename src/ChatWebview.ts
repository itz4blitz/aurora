import * as vscode from 'vscode';
import { AIModel, CodeChange, ScrapedResponse, DiffChange, WebviewMessage, AIModelConfig } from '@types';
import { DiffView } from '@ui/components/DiffView';
import { DiffService } from '@services/DiffService';

export class ChatWebview {
    private static instance: ChatWebview;
    private panel?: vscode.WebviewPanel;
    private iframe: HTMLIFrameElement | undefined;
    private currentModelConfig: AIModelConfig;
    private observer: MutationObserver | undefined;
    private pendingChanges: DiffChange[] = [];
    private currentChangeIndex: number = 0;
    private diffView: DiffView;
    private diffService: DiffService;
    private currentDiffs: DiffChange[] = [];

    private constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly context: vscode.ExtensionContext
    ) {
        this.currentModelConfig = {
            type: 'gpt-3.5-turbo',
            config: {}
        };
        this.panel = vscode.window.createWebviewPanel(
            'auroraChat',
            'Aurora AI Chat',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.extensionUri]
            }
        );
        this.diffView = new DiffView(this.panel.webview, this.extensionUri);
        this.diffService = DiffService.getInstance();
        this.setupDiffMessageHandling();
    }

    public static getInstance(extensionUri: vscode.Uri, context: vscode.ExtensionContext): ChatWebview {
        if (!ChatWebview.instance) {
            ChatWebview.instance = new ChatWebview(extensionUri, context);
        }
        return ChatWebview.instance;
    }

    public getWebview(): vscode.Webview | undefined {
        return this.panel?.webview;
    }

    public async handleCommand(command: string, ...args: any[]) {
        switch (command) {
            case 'switchModel':
                await this.handleModelSwitch(args[0]);
                break;
            // Add other command handlers
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

    private async setupMessageHandling() {
        if (!this.panel) return;

        this.panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
            switch (message.type) {
                case 'switchModel':
                    await this.handleModelSwitch(message.model);
                    break;
                case 'o1proResponse':
                    await this.handleO1ProResponse(message.response);
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
        });
    }

    private async handleModelSwitch(model: AIModel) {
        this.currentModelConfig = { type: model, config: {} };
        await vscode.commands.executeCommand('aiAssistant.modelSwitched', model);
        
        if (this.panel) {
            await this.panel.webview.postMessage({
                type: 'modelSwitched',
                model: model
            });
        }
    }

    private async handleO1ProResponse(response: ScrapedResponse) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const selection = editor.selection;
        const originalText = document.getText(selection);

        const diffs = this.generateDiffs(originalText, response.suggestedCode);
        this.pendingChanges = diffs.map(diff => ({
            original: diff.original,
            suggested: diff.suggested,
            range: new vscode.Range(
                document.positionAt(diff.startOffset),
                document.positionAt(diff.endOffset)
            ),
            status: 'pending'
        }));

        await this.showCurrentDiff();
    }

    private generateDiffs(original: string, suggested: string): Array<{
        original: string,
        suggested: string,
        startOffset: number,
        endOffset: number
    }> {
        // Simple line-by-line diff for now
        const originalLines = original.split('\n');
        const suggestedLines = suggested.split('\n');
        const diffs: Array<{
            original: string,
            suggested: string,
            startOffset: number,
            endOffset: number
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
                    endOffset: offset + Math.max(originalLine.length, suggestedLine.length)
                });
            }
            offset += originalLine.length + 1; // +1 for newline
        }

        return diffs;
    }

    private async showCurrentDiff() {
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
                    total: this.pendingChanges.length
                }
            });
        }
    }

    private getDiffDecoration(): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
            border: '1px solid',
            borderColor: new vscode.ThemeColor('diffEditor.insertedTextBorder')
        });
    }

    private async acceptAllChanges() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        // Apply all changes in reverse order to maintain correct positions
        const sortedChanges = [...this.pendingChanges]
            .sort((a, b) => b.range.start.line - a.range.start.line);

        await editor.edit(editBuilder => {
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
                remaining: 0
            });
        }
    }

    private async acceptNextChange() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || this.currentChangeIndex >= this.pendingChanges.length) return;

        const currentChange = this.pendingChanges[this.currentChangeIndex];
        
        await editor.edit(editBuilder => {
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
                    remaining: 0
                });
            }
        }
    }

    private async rejectChanges() {
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
                type: 'changesRejected'
            });
        }
    }

    public async show() {
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
                localResourceRoots: [this.extensionUri]
            }
        );

        this.panel.webview.html = this.getWebviewContent();
        this.setupMessageHandling();
        this.panel.onDidDispose(() => this.dispose());
    }

    private dispose() {
        this.panel = undefined;
        if (this.observer) {
            this.observer.disconnect();
        }
    }

    private setupDiffMessageHandling() {
        this.panel?.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'acceptDiff':
                    await this.handleAcceptDiff(message.diffId);
                    break;
                case 'rejectDiff':
                    await this.handleRejectDiff(message.diffId);
                    break;
                case 'acceptAllDiffs':
                    await this.handleAcceptAllDiffs();
                    break;
                case 'rejectAllDiffs':
                    await this.handleRejectAllDiffs();
                    break;
            }
        });
    }

    async showDiffs(original: string, suggested: string) {
        this.currentDiffs = await this.diffService.computeDiffs(original, suggested);
        await this.updateDiffView();
    }

    private async updateDiffView() {
        if (this.panel) {
            const content = this.diffView.getWebviewContent(this.currentDiffs);
            await this.panel.webview.postMessage({
                type: 'updateDiffs',
                content
            });
        }
    }

    private async handleAcceptDiff(diffId: number) {
        const diff = this.currentDiffs[diffId];
        if (!diff) return;

        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        await editor.edit(editBuilder => {
            editBuilder.replace(diff.range, diff.suggested);
        });

        diff.status = 'accepted';
        await this.updateDiffView();
    }

    private async handleRejectDiff(diffId: number) {
        const diff = this.currentDiffs[diffId];
        if (!diff) return;

        diff.status = 'rejected';
        await this.updateDiffView();
    }

    private async handleAcceptAllDiffs() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        // Apply changes in reverse order to maintain correct positions
        const sortedDiffs = [...this.currentDiffs]
            .sort((a, b) => b.range.start.line - a.range.start.line);

        await editor.edit(editBuilder => {
            for (const diff of sortedDiffs) {
                if (diff.status === 'pending') {
                    editBuilder.replace(diff.range, diff.suggested);
                    diff.status = 'accepted';
                }
            }
        });

        await this.updateDiffView();
    }

    private async handleRejectAllDiffs() {
        for (const diff of this.currentDiffs) {
            if (diff.status === 'pending') {
                diff.status = 'rejected';
            }
        }
        await this.updateDiffView();
    }

    // ... implement other diff-related methods
} 