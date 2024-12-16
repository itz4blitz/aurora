import 'module-alias/register';
import * as vscode from 'vscode';
import { CommandManager } from '@commands/CommandManager';
import { ConfigManager } from '@config/ConfigManager';
import { ChatWebview } from '@webview/ChatWebview';
import { ConversationManager } from '@services/ConversationManager';
import { GeminiService } from '@services/GeminiService';
import { ChatViewProvider } from '@ui/views/ChatViewProvider';
import { HistoryViewProvider } from '@ui/views/HistoryViewProvider';
import { AIModel } from '@/types';
import JSZip from 'jszip';

// Define types locally to avoid import issues
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ModelConfigWithType {
  type: AIModel;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

interface WebviewState {
  messages?: Message[];
  modelConfig?: ModelConfigWithType;
  scrollPosition?: number;
  pendingInput?: string;
}

let disposables: vscode.Disposable[] = [];
let extensionContext: vscode.ExtensionContext;

// Update the TypedJSZip type to include static methods
type TypedJSZip = {
  file(name: string, data: Buffer): void;
  generateAsync(options: { type: string }): Promise<Buffer>;
  files: Record<
    string,
    {
      dir?: boolean;
      async(type: 'nodebuffer'): Promise<Buffer>;
    }
  >;
};

type JSZipConstructor = {
  new (): TypedJSZip;
  loadAsync(data: Buffer): Promise<TypedJSZip>;
};

// Cast JSZip to include both instance and static methods
const TypedJSZip = JSZip as unknown as JSZipConstructor;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  extensionContext = context;

  try {
    // Register commands first, before anything else
    const openChatCommand = vscode.commands.registerCommand('aurora.openChat', () => {
      console.log('Opening chat...');
      return vscode.commands.executeCommand('workbench.view.extension.aurora-sidebar');
    });

    const configureCommand = vscode.commands.registerCommand('aurora.configure', () => {
      console.log('Opening configuration...');
      return vscode.commands.executeCommand('workbench.action.openSettings', 'aurora');
    });

    const focusChatCommand = vscode.commands.registerCommand('aurora.focusChat', () => {
      const chatView = vscode.window.createWebviewPanel(
        'auroraChat',
        'Aurora Chat',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );
      chatView.reveal();
    });

    const focusHistoryCommand = vscode.commands.registerCommand('aurora.focusHistory', () => {
      const historyView = vscode.window.createWebviewPanel(
        'auroraHistory',
        'Chat History',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );
      historyView.reveal();
    });

    const exportCommand = vscode.commands.registerCommand('aurora.export', async () => {
      try {
        const conversations = await vscode.workspace.findFiles('**/.aurora/conversations/*.json');
        if (conversations.length === 0) {
          void vscode.window.showInformationMessage('No conversations to export');
          return;
        }

        const saveLocation = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file('aurora-conversations.zip'),
          filters: { 'ZIP files': ['zip'] },
        });

        if (saveLocation) {
          const zip = new TypedJSZip();

          for (const conversation of conversations) {
            const content = await vscode.workspace.fs.readFile(conversation);
            const pathParts = conversation.path.split('/');
            const fileName = pathParts[pathParts.length - 1];
            if (fileName) {
              zip.file(fileName, Buffer.from(content));
            }
          }

          const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
          await vscode.workspace.fs.writeFile(saveLocation, zipContent);
          void vscode.window.showInformationMessage('Conversations exported successfully');
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        void vscode.window.showErrorMessage(`Export failed: ${errorMessage}`);
      }
    });

    const importCommand = vscode.commands.registerCommand('aurora.import', async () => {
      try {
        const fileToImport = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: false,
          filters: { 'ZIP files': ['zip'] },
        });

        if (fileToImport?.[0]) {
          const zipContent = await vscode.workspace.fs.readFile(fileToImport[0]);
          const zip = await TypedJSZip.loadAsync(Buffer.from(zipContent));

          const storageDir = vscode.Uri.joinPath(context.globalStorageUri, 'conversations');
          await vscode.workspace.fs.createDirectory(storageDir);

          const files = zip.files;
          for (const [filename, file] of Object.entries(files)) {
            if (!file.dir) {
              const content = await file.async('nodebuffer');
              const targetPath = vscode.Uri.joinPath(storageDir, filename);
              await vscode.workspace.fs.writeFile(targetPath, content);
            }
          }
          void vscode.window.showInformationMessage('Conversations imported successfully');
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        void vscode.window.showErrorMessage(`Import failed: ${errorMessage}`);
      }
    });

    const toggleModelCommand = vscode.commands.registerCommand('aurora.toggleModel', async () => {
      try {
        const models = ['GPT-4', 'GPT-3.5-Turbo', 'Claude-2', 'Gemini Pro'] as const;
        const selectedModel = await vscode.window.showQuickPick(models, {
          placeHolder: 'Select AI Model',
          title: 'Toggle AI Model',
          canPickMany: false,
        });

        if (selectedModel) {
          await context.globalState.update('selectedModel', selectedModel);
          void vscode.window.showInformationMessage(`Switched to ${selectedModel}`);
          void vscode.commands.executeCommand('aurora.modelChanged', selectedModel);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        void vscode.window.showErrorMessage(`Failed to toggle model: ${errorMessage}`);
      }
    });

    // Add commands to subscriptions immediately
    context.subscriptions.push(
      openChatCommand,
      configureCommand,
      focusChatCommand,
      focusHistoryCommand,
      exportCommand,
      importCommand,
      toggleModelCommand,
      vscode.commands.registerCommand('aurora.exportConversations', () => {
        console.log('Executing export command');
        void vscode.window.showInformationMessage('Export functionality coming soon!');
      }),
      vscode.commands.registerCommand('aurora.importConversations', () => {
        console.log('Executing import command');
        void vscode.window.showInformationMessage('Import functionality coming soon!');
      })
      // Removed duplicate toggleModel command registration to avoid conflicts
    );

    // Initialize configuration
    const configManager = ConfigManager.initialize(context);
    const initConfig = configManager.initializeConfig();
    if (initConfig instanceof Promise) {
      await initConfig;
    }

    // Register view providers
    const chatViewProvider = new ChatViewProvider(context);
    const historyViewProvider = new HistoryViewProvider(context);

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider('aurora.chatView', chatViewProvider),
      vscode.window.registerWebviewViewProvider('aurora.historyView', historyViewProvider)
    );

    // Register webview serializer for state persistence
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer('auroraChat', {
        async deserializeWebviewPanel(
          _webviewPanel: vscode.WebviewPanel,
          state: WebviewState
        ): Promise<void> {
          const chatWebview = ChatWebview.getInstance(context.extensionUri, context);
          chatWebview.show();

          if (state) {
            if (state.messages && Array.isArray(state.messages)) {
              const messagePromises = state.messages.map((message) => {
                const typedMessage: Message = {
                  id: String(message.id),
                  role: message.role,
                  content: String(message.content),
                  timestamp: Number(message.timestamp),
                };
                return chatWebview.restoreMessage(typedMessage);
              });
              await Promise.all(messagePromises);
            }

            if (state.modelConfig) {
              const typedConfig: ModelConfigWithType = {
                type: state.modelConfig.type,
                temperature: Number(state.modelConfig.temperature),
                maxTokens: Number(state.modelConfig.maxTokens),
                topP: Number(state.modelConfig.topP),
                frequencyPenalty: Number(state.modelConfig.frequencyPenalty),
                presencePenalty: Number(state.modelConfig.presencePenalty),
              };
              await chatWebview.setModelConfig(typedConfig);
            }

            if (typeof state.scrollPosition === 'number') {
              await chatWebview.restoreScrollPosition(state.scrollPosition);
            }

            if (typeof state.pendingInput === 'string') {
              await chatWebview.restoreInput(state.pendingInput);
            }
          }
        },
      })
    );

    // Initialize services
    void GeminiService.getInstance();
    const geminiKey = await configManager.getGeminiApiKey();

    if (!geminiKey) {
      void vscode.window.showWarningMessage('Gemini API key not configured');
    }

    const conversationManager = new ConversationManager(geminiKey ?? '');
    const commandManager = CommandManager.getInstance(context, conversationManager, configManager);
    commandManager.registerCommands();

    // Log successful activation
    console.log('Aurora AI Extension activated');
    void vscode.window.showInformationMessage('Aurora AI is ready to assist you!');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to activate Aurora:', errorMessage);
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
