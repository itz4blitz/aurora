import 'module-alias/register';
import * as vscode from 'vscode';
import { CommandManager } from '@commands/CommandManager';
import { ConfigManager } from '@config/ConfigManager';
import { ChatWebview } from '@webview/ChatWebview';
import { ConversationManager } from '@services/ConversationManager';
import { GeminiService } from '@services/GeminiService';

let disposables: vscode.Disposable[] = [];
let extensionContext: vscode.ExtensionContext;

export async function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    
    try {
        // Initialize configuration first
        const configManager = ConfigManager.initialize(context);
        await configManager.initializeConfig();
        
        // Initialize services
        const geminiService = GeminiService.getInstance();
        
        // Get authentication tokens
        const geminiKey = await configManager.getGeminiApiKey();
        if (!geminiKey) {
            vscode.window.showWarningMessage('Gemini API key not configured');
        }
        
        // Initialize conversation manager
        const conversationManager = new ConversationManager(geminiKey || '');

        // Initialize command manager with required parameters
        const commandManager = CommandManager.getInstance(context, conversationManager, configManager);

        // Register all commands
        commandManager.registerCommands();

        // Register configuration change listener
        const configListener = vscode.workspace.onDidChangeConfiguration(async e => {
            if (e.affectsConfiguration('aurora')) {
                await configManager.initializeConfig();
            }
        });
        disposables.push(configListener);

        // Register webview serializer for state persistence
        vscode.window.registerWebviewPanelSerializer('auroraChat', {
            async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
                const chatWebview = ChatWebview.getInstance(context.extensionUri, context);
                await chatWebview.show();
                if (state) {
                    // Restore webview state
                    if (state.messages) {
                        await Promise.all(state.messages.map(async (message: any) => {
                            await chatWebview.restoreMessage(message);
                        }));
                    }
                    
                    if (state.modelConfig) {
                        await chatWebview.setModelConfig(state.modelConfig);
                    }
                    
                    if (state.scrollPosition) {
                        await chatWebview.restoreScrollPosition(state.scrollPosition);
                    }
                    
                    if (state.pendingInput) {
                        await chatWebview.restoreInput(state.pendingInput);
                    }
                }
            }
        });

        // Show success message
        vscode.window.showInformationMessage('Aurora AI is ready to assist you!');

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to activate Aurora: ${error}`);
        throw error;
    }
}

export function deactivate() {
    // Clean up services
    GeminiService.getInstance().dispose();
    
    // Clean up webview
    const chatWebview = ChatWebview.getInstance(vscode.Uri.file(''), extensionContext);
    if (chatWebview) {
        chatWebview.show();  // This will handle proper cleanup internally
    }
    
    // Dispose of all registered disposables
    disposables.forEach(d => d.dispose());
    disposables = [];
}