import * as vscode from 'vscode';
import { DiffChange } from '../../types';

export class DiffView {
    private static readonly DIFF_HTML = `
        <div class="diff-container">
            <div class="diff-header">
                <h3>Suggested Changes</h3>
                <div class="diff-actions">
                    <button id="accept-all">Accept All</button>
                    <button id="reject-all">Reject All</button>
                </div>
            </div>
            <div class="diff-content">
                <!-- Diffs will be inserted here -->
            </div>
        </div>
    `;

    private static readonly DIFF_STYLES = `
        .diff-container {
            margin: 10px 0;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        .diff-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: var(--vscode-panel-background);
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .diff-actions {
            display: flex;
            gap: 8px;
        }
        .diff-content {
            padding: 10px;
        }
        .diff-item {
            margin: 8px 0;
            padding: 8px;
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family);
        }
        .diff-item.pending {
            background: var(--vscode-diffEditor-insertedTextBackground);
            border: 1px dashed var(--vscode-diffEditor-insertedLineBackground);
        }
        .diff-item.accepted {
            background: var(--vscode-diffEditor-insertedTextBackground);
            border: 1px solid var(--vscode-charts-green);
        }
        .diff-item.rejected {
            background: var(--vscode-diffEditor-removedTextBackground);
            border: 1px solid var(--vscode-charts-red);
            text-decoration: line-through;
        }
    `;

    constructor(
        private readonly webview: vscode.Webview,
        private readonly extensionUri: vscode.Uri
    ) {}

    getWebviewContent(diffs: DiffChange[]): string {
        return `
            <style>${DiffView.DIFF_STYLES}</style>
            ${DiffView.DIFF_HTML}
            <script>
                ${this.getWebviewScript()}
            </script>
            ${this.renderDiffs(diffs)}
        `;
    }

    private renderDiffs(diffs: DiffChange[]): string {
        return diffs.map((diff, index) => `
            <div class="diff-item ${diff.status}" data-diff-id="${index}">
                <div class="diff-item-header">
                    <span class="diff-item-title">Change ${index + 1}</span>
                    <div class="diff-item-actions">
                        <button class="accept-diff" data-diff-id="${index}">Accept</button>
                        <button class="reject-diff" data-diff-id="${index}">Reject</button>
                    </div>
                </div>
                <pre class="diff-item-content">
                    <code>${this.escapeHtml(diff.suggested)}</code>
                </pre>
            </div>
        `).join('');
    }

    private getWebviewScript(): string {
        return `
            (function() {
                const vscode = acquireVsCodeApi();

                document.addEventListener('click', (e) => {
                    const target = e.target;
                    if (target.classList.contains('accept-diff')) {
                        const diffId = target.dataset.diffId;
                        vscode.postMessage({
                            type: 'acceptDiff',
                            diffId: parseInt(diffId)
                        });
                    } else if (target.classList.contains('reject-diff')) {
                        const diffId = target.dataset.diffId;
                        vscode.postMessage({
                            type: 'rejectDiff',
                            diffId: parseInt(diffId)
                        });
                    } else if (target.id === 'accept-all') {
                        vscode.postMessage({ type: 'acceptAllDiffs' });
                    } else if (target.id === 'reject-all') {
                        vscode.postMessage({ type: 'rejectAllDiffs' });
                    }
                });
            })();
        `;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
} 