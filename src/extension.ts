import 'module-alias/register';
import * as vscode from 'vscode';
import { CommandManager } from '@commands/CommandManager';
import { ConfigManager } from '@config/ConfigManager';
import { ChatWebview } from '@webview/ChatWebview';
import { ConversationManager } from '@services/ConversationManager';
import { GeminiService } from '@services/GeminiService';
import type { WebviewState, ModelConfigWithType } from '@types';

let disposables: vscode.Disposable[] = [];
let extensionContext: vscode.ExtensionContext;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  extensionContext = context;

  try {
    // Initialize configuration first
    const configManager = ConfigManager.initialize(context);
    void configManager.initializeConfig();

    // Initialize services and get key
    void GeminiService.getInstance();
    const geminiKey = await configManager.getGeminiApiKey();

    if (!geminiKey) {
      void vscode.window.showWarningMessage('Gemini API key not configured');
    }

    // Initialize conversation manager
    const conversationManager = new ConversationManager(geminiKey ?? '');

    // Initialize command manager with required parameters
    const commandManager = CommandManager.getInstance(context, conversationManager, configManager);

    // Register all commands
    void commandManager.registerCommands();

    // Register configuration change listener
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('aurora')) {
        void configManager.initializeConfig();
      }
    });
    disposables.push(configListener);

    // Register webview serializer for state persistence
    vscode.window.registerWebviewPanelSerializer('auroraChat', {
      async deserializeWebviewPanel(
        _webviewPanel: vscode.WebviewPanel,
        state: WebviewState
      ): Promise<void> {
        const chatWebview = ChatWebview.getInstance(context.extensionUri, context);

        // Show the webview without awaiting if it doesn't return a Promise
        chatWebview.show();

        // Add a small delay to ensure webview is ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (state) {
          if (state.messages) {
            const messagePromises = state.messages.map((message) =>
              chatWebview.restoreMessage(message)
            );
            await Promise.all(messagePromises);
          }

          if (state.modelConfig) {
            await chatWebview.setModelConfig(state.modelConfig as ModelConfigWithType);
          }

          if (state.scrollPosition) {
            await chatWebview.restoreScrollPosition(state.scrollPosition);
          }

          if (state.pendingInput) {
            await chatWebview.restoreInput(state.pendingInput);
          }
        }
      },
    });

    // Show success message
    void vscode.window.showInformationMessage('Aurora AI is ready to assist you!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    void vscode.window.showErrorMessage(`Failed to activate Aurora: ${errorMessage}`);
    throw error;
  }
}

export function deactivate(): void {
  // Clean up services
  GeminiService.getInstance().dispose();

  // Clean up webview
  const chatWebview: ChatWebview | null = ChatWebview.getInstance(
    vscode.Uri.file(''),
    extensionContext
  );
  if (chatWebview) {
    void chatWebview.dispose();
  }

  // Dispose of all registered disposables
  for (const disposable of disposables) {
    if (disposable && typeof disposable.dispose === 'function') {
      disposable.dispose();
    }
  }
  disposables = [];
}
