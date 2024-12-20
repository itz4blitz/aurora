import * as vscode from 'vscode';
import { ConfigManager } from '@config/ConfigManager';
import { ErrorManager } from '@error/ErrorManager';
import { Logger } from '@utils/Logger';
import { ErrorSeverity, Settings, DEFAULT_MODEL_CONFIGS } from '@/types';

// Define all possible message types including responses
type SettingsWebviewMessage =
  | { type: 'updateSettings'; settings: Partial<Settings> }
  | { type: 'getSettings' }
  | { type: 'resetSettings' }
  | { type: 'settingsLoaded'; settings: Settings };

export class SettingsWebview {
  private panel: vscode.WebviewPanel | null = null;
  private readonly configManager: ConfigManager;
  private readonly errorManager: ErrorManager;
  private readonly logger: Logger;

  constructor() {
    this.configManager = ConfigManager.getInstance();
    this.errorManager = ErrorManager.getInstance();
    this.logger = Logger.getInstance();
  }

  public async show(): Promise<void> {
    try {
      if (this.panel) {
        this.panel.reveal();
        return;
      }

      this.panel = vscode.window.createWebviewPanel(
        'auroraSettings',
        'Aurora Settings',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      const content = await this.getWebviewContent();
      this.panel.webview.html = content;

      void this.panel.onDidDispose(() => {
        this.panel = null;
        this.logger.info('Settings webview disposed');
      });

      void this.panel.webview.onDidReceiveMessage((rawMessage: unknown) => {
        void this.handleMessage(rawMessage as SettingsWebviewMessage);
      });

      // Load initial settings
      const settings = await this.configManager.getAllSettings();
      if (this.panel?.webview) {
        void this.panel.webview.postMessage({
          type: 'settingsLoaded',
          settings,
        });
      }

      this.logger.info('Settings webview initialized');
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'SettingsWebview.show',
        ErrorSeverity.Error
      );
    }
  }

  private async handleMessage(message: SettingsWebviewMessage): Promise<void> {
    try {
      this.logger.debug(`Handling settings message: ${message.type}`);

      switch (message.type) {
        case 'updateSettings': {
          const settings = message.settings;
          if (settings.geminiApiKey) {
            const isValid = await this.configManager.hasValidGeminiKey();
            if (!isValid) {
              void vscode.window.showErrorMessage('Invalid Gemini API key');
              this.logger.warn('Invalid Gemini API key provided');
              return;
            }
          }
          await this.configManager.updateSettings(settings);
          void vscode.window.showInformationMessage('Settings updated successfully');
          this.logger.info('Settings updated successfully');
          break;
        }

        case 'getSettings': {
          const settings = await this.configManager.getAllSettings();
          if (this.panel?.webview) {
            void this.panel.webview.postMessage({
              type: 'settingsLoaded',
              settings,
            });
          }
          this.logger.debug('Settings loaded and sent to webview');
          break;
        }

        case 'resetSettings': {
          await this.resetSettings();
          break;
        }

        default: {
          this.logger.warn(`Unknown message type received: ${(message as { type: string }).type}`);
        }
      }
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'SettingsWebview.handleMessage',
        ErrorSeverity.Error
      );
    }
  }

  private async getWebviewContent(): Promise<string> {
    const settings = await this.configManager.getAllSettings();

    return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Aurora Settings</title>
                <style>
                    body { padding: 20px; }
                    .setting-group { margin-bottom: 20px; }
                    .setting-item { margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="setting-group">
                    <h2>API Keys</h2>
                    <div class="setting-item">
                        <label>Gemini API Key:</label>
                        <input type="password" id="geminiApiKey" value="${settings.geminiApiKey || ''}">
                    </div>
                </div>
                <div class="setting-group">
                    <h2>Model Settings</h2>
                    <div class="setting-item">
                        <label>Default Model:</label>
                        <select id="defaultModel">
                            <option value="gpt-3.5-turbo" ${settings.defaultModel === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5</option>
                            <option value="gpt-4" ${settings.defaultModel === 'gpt-4' ? 'selected' : ''}>GPT-4</option>
                            <option value="gemini-pro" ${settings.defaultModel === 'gemini-pro' ? 'selected' : ''}>Gemini Pro</option>
                            <option value="claude-3-sonnet" ${settings.defaultModel === 'claude-3-sonnet' ? 'selected' : ''}>Claude 3 Sonnet</option>
                            <option value="o1pro" ${settings.defaultModel === 'o1pro' ? 'selected' : ''}>O1Pro</option>
                        </select>
                    </div>
                </div>
                <button onclick="saveSettings()">Save Settings</button>
                <button onclick="resetSettings()">Reset Settings</button>
                <script>
                    const vscode = acquireVsCodeApi();

                    function saveSettings() {
                        const settings = {
                            geminiApiKey: document.getElementById('geminiApiKey').value,
                            defaultModel: document.getElementById('defaultModel').value
                        };
                        vscode.postMessage({ type: 'updateSettings', settings });
                    }

                    function resetSettings() {
                        vscode.postMessage({ type: 'resetSettings' });
                    }

                    window.addEventListener('message', event => {
                        const message = event.data as { type: string; settings?: Settings };
                        if (message.type === 'settingsLoaded' && message.settings) {
                            if (message.settings.geminiApiKey) {
                                document.getElementById('geminiApiKey').value = message.settings.geminiApiKey;
                            }
                            if (message.settings.defaultModel) {
                                document.getElementById('defaultModel').value = message.settings.defaultModel;
                            }
                        }
                    });
                </script>
            </body>
            </html>
        `;
  }

  private async resetSettings(): Promise<void> {
    try {
      const defaultSettings: Settings = {
        defaultModel: 'gpt-3.5-turbo',
        shortcuts: {},
        modelConfigs: DEFAULT_MODEL_CONFIGS,
        geminiApiKey: '',
        openAIApiKey: '',
        anthropicApiKey: '',
        theme: 'system',
        fontSize: 14,
        fontFamily: 'monospace',
        showLineNumbers: true,
        autoSave: true,
        useMarkdown: true,
      };

      await this.configManager.updateSettings(defaultSettings);
      if (this.panel) {
        void this.panel.webview.postMessage({
          type: 'settingsLoaded',
          settings: defaultSettings,
        });
      }

      void vscode.window.showInformationMessage('Settings reset to defaults');
      this.logger.info('Settings reset to defaults');
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'SettingsWebview.resetSettings',
        ErrorSeverity.Error
      );
    }
  }

  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
    this.logger.info('Settings webview disposed');
  }
}
