import * as vscode from 'vscode';
import { ChatWebview } from '@webview/ChatWebview';
import { ConversationManager } from '@services/ConversationManager';
import { ConfigManager } from '@config/ConfigManager';
import { ConversationIO } from '@utils/ConversationIO';
import { StatusBarManager } from '@status/StatusBarManager';
import { O1ProService } from '@services/O1ProService';
import { ErrorManager } from '@error/ErrorManager';
import { ErrorSeverity } from '@types';
import { Logger } from '@utils/Logger';
import { AIModel } from '@types';
import { FileIO } from '@utils/FileIO';

export class CommandManager {
    private static instance: CommandManager;
    private disposables: vscode.Disposable[] = [];
    private activeWebview?: ChatWebview;
    private statusBarManager: StatusBarManager;
    private o1proService: O1ProService;
    private errorManager: ErrorManager;
    private logger: Logger;

    private constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly conversationManager: ConversationManager,
        private readonly configManager: ConfigManager
    ) {
        this.statusBarManager = new StatusBarManager();
        this.o1proService = O1ProService.getInstance();
        this.errorManager = ErrorManager.getInstance();
        this.logger = Logger.getInstance();
    }

    static getInstance(
        context: vscode.ExtensionContext,
        conversationManager: ConversationManager,
        configManager: ConfigManager
    ): CommandManager {
        if (!CommandManager.instance) {
            CommandManager.instance = new CommandManager(
                context,
                conversationManager,
                configManager
            );
        }
        return CommandManager.instance;
    }

    registerCommands() {
        // Main commands
        this.register('aurora.openChat', () => this.openChat());
        this.register('aurora.toggleModel', () => this.toggleModel());
        this.register('aurora.exportConversations', () => this.exportConversations());
        this.register('aurora.importConversations', () => this.importConversations());
        this.register('aurora.newConversation', () => this.newConversation());
        this.register('aurora.searchConversations', () => this.focusSearch());
        this.register('aurora.pinConversation', () => this.togglePin());
        this.register('aurora.starConversation', () => this.toggleStar());

        // Editor context menu commands
        this.register('aurora.copySnippet', (uri: vscode.Uri) => this.handleSnippet(uri));
        this.register('aurora.explainCode', (uri: vscode.Uri) => this.explainCode(uri));
        this.register('aurora.improveCode', (uri: vscode.Uri) => this.improveCode(uri));
        this.register('aurora.findIssues', (uri: vscode.Uri) => this.findIssues(uri));

        // Register keyboard shortcuts
        this.registerKeyboardShortcuts();

        // Add new O1Pro-specific commands
        this.register('aurora.injectO1ProScript', () => this.injectO1ProScript());
        this.register('aurora.parseO1ProResponse', () => this.parseO1ProResponse());
    }

    private register(command: string, callback: (...args: any[]) => any) {
        const disposable = vscode.commands.registerCommand(command, callback);
        this.disposables.push(disposable);
        this.context.subscriptions.push(disposable);
    }

    private registerKeyboardShortcuts() {
        const shortcuts = this.configManager.getShortcuts();
        
        // Register each shortcut with VSCode
        Object.entries(shortcuts).forEach(([command, shortcut]) => {
            const disposable = vscode.commands.registerCommand(`aurora.${command}`, () => {
                this.handleShortcut(command);
            });
            this.context.subscriptions.push(disposable);
        });
    }

    private async handleShortcut(command: string) {
        if (!this.activeWebview) {
            await this.openChat();
        }

        if (this.activeWebview) {
            await this.activeWebview.handleCommand(command);
            this.statusBarManager.update(command);
        }
    }

    private async openChat() {
        if (!this.activeWebview) {
            this.activeWebview = ChatWebview.getInstance(this.context.extensionUri, this.context);
            await this.activeWebview.show();
            this.statusBarManager.show();
        } else {
            await this.activeWebview.show();
        }
    }

    private async toggleModel() {
        const currentModel = await this.configManager.getDefaultModel();
        const modelSequence: AIModel[] = [
            'gpt-3.5-turbo',
            'gpt-4',
            'gemini-pro',
            'claude-3-sonnet',
            'o1pro'
        ];
        
        const currentIndex = modelSequence.indexOf(currentModel);
        const nextModel = modelSequence[(currentIndex + 1) % modelSequence.length];
        
        await this.configManager.updateDefaultModel(nextModel);
        
        if (this.activeWebview) {
            await this.activeWebview.handleCommand('switchModel', { model: nextModel });
            this.statusBarManager.updateModel(nextModel);
        }
    }

    private async exportConversations() {
        try {
            const conversations = await this.conversationManager.fetchConversations();
            await ConversationIO.exportConversations(conversations);
            vscode.window.showInformationMessage('Conversations exported successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export conversations: ${error}`);
        }
    }

    private async importConversations() {
        try {
            const conversations = await ConversationIO.importConversations();
            // Implement conversation import logic here
            vscode.window.showInformationMessage(`Imported ${conversations.length} conversations`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import conversations: ${error}`);
        }
    }

    private async handleSnippet(uri: vscode.Uri) {
        try {
            const editor = vscode.window.activeTextEditor;
            if (editor && this.activeWebview) {
                const selection = editor.selection;
                const text = editor.document.getText(selection);
                const webview = this.activeWebview.getWebview();
                
                // Use O1Pro service to handle the snippet
                if (webview && (await this.configManager.getDefaultModel()).startsWith('gpt-')) {
                    await this.o1proService.injectScrapingScript(webview);
                }
                
                await this.activeWebview.handleCommand('insertSnippet', { text });
            }
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'CommandManager.handleSnippet',
                ErrorSeverity.Error
            );
        }
    }

    private async explainCode(uri: vscode.Uri) {
        try {
            const editor = vscode.window.activeTextEditor;
            if (editor && this.activeWebview) {
                const selection = editor.selection;
                const text = editor.document.getText(selection);
                const webview = this.activeWebview.getWebview();
                
                if (webview && (await this.configManager.getDefaultModel()).startsWith('gpt-')) {
                    await this.o1proService.injectScrapingScript(webview);
                    this.logger.info('Injected O1Pro scraping script for code explanation');
                }
                
                await this.activeWebview.handleCommand('explainCode', { text });
            }
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'CommandManager.explainCode',
                ErrorSeverity.Error
            );
        }
    }

    private async improveCode(uri: vscode.Uri) {
        try {
            const editor = vscode.window.activeTextEditor;
            if (editor && this.activeWebview) {
                const selection = editor.selection;
                const text = editor.document.getText(selection);
                const webview = this.activeWebview.getWebview();
                
                if (webview && (await this.configManager.getDefaultModel()).startsWith('gpt-')) {
                    await this.o1proService.injectScrapingScript(webview);
                    this.logger.info('Injected O1Pro scraping script for code improvement');
                }
                
                await this.activeWebview.handleCommand('improveCode', { text });
            }
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'CommandManager.improveCode',
                ErrorSeverity.Error
            );
        }
    }

    private async findIssues(uri: vscode.Uri) {
        try {
            const editor = vscode.window.activeTextEditor;
            if (editor && this.activeWebview) {
                const selection = editor.selection;
                const text = editor.document.getText(selection);
                const webview = this.activeWebview.getWebview();
                
                if (webview && (await this.configManager.getDefaultModel()).startsWith('gpt-')) {
                    await this.o1proService.injectScrapingScript(webview);
                    this.logger.info('Injected O1Pro scraping script for issue finding');
                }
                
                await this.activeWebview.handleCommand('findIssues', { text });
            }
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'CommandManager.findIssues',
                ErrorSeverity.Error
            );
        }
    }

    private newConversation() {
        this.activeWebview?.handleCommand('newConversation');
    }

    private focusSearch() {
        this.activeWebview?.handleCommand('focusSearch');
    }

    private togglePin() {
        this.activeWebview?.handleCommand('togglePin');
    }

    private toggleStar() {
        this.activeWebview?.handleCommand('toggleStar');
    }

    private async injectO1ProScript() {
        try {
            if (this.activeWebview) {
                const webview = this.activeWebview.getWebview();
                if (webview && (await this.configManager.getDefaultModel()).startsWith('gpt-')) {
                    await this.o1proService.injectScrapingScript(webview);
                    this.logger.info('Manually injected O1Pro scraping script');
                }
            }
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'CommandManager.injectO1ProScript',
                ErrorSeverity.Error
            );
        }
    }

    private async parseO1ProResponse() {
        try {
            if (this.activeWebview) {
                const webview = this.activeWebview.getWebview();
                if (webview && (await this.configManager.getDefaultModel()).startsWith('gpt-')) {
                    const response = await this.o1proService.parseResponse(webview);
                    this.logger.info(`Parsed O1Pro response: ${JSON.stringify(response)}`);
                    return response;
                }
            }
        } catch (error) {
            await this.errorManager.handleError(
                error as Error,
                'CommandManager.parseO1ProResponse',
                ErrorSeverity.Error
            );
        }
    }

    private async handleCommand(command: string) {
        try {
            const currentModel = await this.configManager.getDefaultModel();
            
            switch (command) {
                case 'generateCode':
                    if (currentModel.startsWith('gpt-')) {
                        // handle GPT models
                    }
                    break;
                // ... other cases
            }
        } catch (error) {
            await this.errorManager.handleError(error as Error, 'handleCommand', ErrorSeverity.Error);
        }
    }

    private async handleExplainCode() {
        try {
            const currentModel = await this.configManager.getDefaultModel();
            if (currentModel.startsWith('gpt-')) {
                // handle GPT models
            }
        } catch (error) {
            await this.errorManager.handleError(error as Error, 'handleExplainCode', ErrorSeverity.Error);
        }
    }

    private async handleGenerateTests() {
        try {
            const currentModel = await this.configManager.getDefaultModel();
            if (currentModel.startsWith('gpt-')) {
                // handle GPT models
            }
        } catch (error) {
            await this.errorManager.handleError(error as Error, 'handleGenerateTests', ErrorSeverity.Error);
        }
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.statusBarManager.dispose();
    }
} 