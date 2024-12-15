import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { ErrorManager } from '../error/ErrorManager';
import { StatusService } from '../services/StatusService';
import { CodeBlockRenderer } from './CodeBlockRenderer';
import { IncrementalCodeView } from './IncrementalCodeView';
import { WebviewProvider } from './WebviewProvider';
import { ErrorSeverity } from '../types';

export class UIManager {
    private static instance: UIManager;
    private readonly logger: Logger;
    private readonly errorManager: ErrorManager;
    private readonly statusService: StatusService;
    private readonly codeRenderer: CodeBlockRenderer;
    private readonly incrementalView: IncrementalCodeView;
    private readonly webviewProvider: WebviewProvider;

    private constructor(
        private readonly context: vscode.ExtensionContext
    ) {
        this.logger = Logger.getInstance();
        this.errorManager = ErrorManager.getInstance();
        this.statusService = StatusService.getInstance();
        this.codeRenderer = CodeBlockRenderer.getInstance();
        this.incrementalView = IncrementalCodeView.getInstance();
        this.webviewProvider = WebviewProvider.getInstance();
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
            await this.statusService.showProgress('Rendering code suggestion', async () => {
                await this.incrementalView.show(code, language);
            });
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'UIManager.showCodeSuggestion',
                ErrorSeverity.Error
            );
        }
    }

    async showLoadingIndicator(message: string): Promise<void> {
        await this.statusService.showStatusBarMessage(message);
    }

    async hideLoadingIndicator(): Promise<void> {
        this.statusService.showStatusBarMessage('');
    }

    async showError(error: Error): Promise<void> {
        await this.statusService.showErrorMessage(error.message);
    }

    async showSuccess(message: string): Promise<void> {
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
                content: original
            });
            const modifiedDoc = await vscode.workspace.openTextDocument({
                content: modified
            });

            await vscode.commands.executeCommand('vscode.diff',
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
        }
    }

    registerWebviewMessageHandlers(handlers: Record<string, (message: any) => Promise<void>>): void {
        Object.entries(handlers).forEach(([command, handler]) => {
            this.context.subscriptions.push(
                vscode.window.registerWebviewPanelSerializer(command, {
                    async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
                        webviewPanel.webview.onDidReceiveMessage(async message => {
                            if (message.command === command) {
                                await handler(message);
                            }
                        });
                    }
                })
            );
        });
    }

    async updateTheme(): Promise<void> {
        // Trigger theme update in all UI components
        await this.incrementalView.show('', ''); // Refresh current view
    }

    dispose(): void {
        this.statusService.dispose();
        this.incrementalView.dispose();
        UIManager.instance = null as unknown as UIManager;
    }
} 