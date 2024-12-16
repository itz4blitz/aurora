import * as vscode from 'vscode';
import { ConfigManager } from '@config/ConfigManager';
import { ErrorManager } from '@error/ErrorManager';
import { Logger } from '@utils/Logger';
import { ErrorSeverity, Settings, DEFAULT_MODEL_CONFIGS, WebviewMessage } from '@types';

export class SettingsWebview {
  private panel: vscode.WebviewPanel | undefined;
  private configManager: ConfigManager;
  private errorManager: ErrorManager;
  private logger: Logger;

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

      const settings = await this.configManager.getAllSettings();
      this.panel.webview.html = this.getWebviewContent(settings);

      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.logger.info('Settings webview disposed');
      });

      this.panel.webview.onDidReceiveMessage((message: unknown) => {
        if (this.isWebviewMessage(message)) {
          void this.handleMessage(message);
        } else {
          this.logger.warn('Invalid message received from webview');
        }
      });

      void this.panel.webview.postMessage({
        type: 'settingsLoaded',
        settings,
      });

      this.logger.info('Settings webview initialized');
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'SettingsWebview.show',
        ErrorSeverity.Error
      );
    }
  }

  private isWebviewMessage(message: unknown): message is WebviewMessage {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      typeof (message as WebviewMessage).type === 'string'
    );
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    try {
      this.logger.debug(`Handling settings message: ${message.type}`);

      switch (message.type) {
        case 'updateSettings': {
          if (!message.settings) {
            throw new Error('No settings provided in update message');
          }

          if (message.settings.geminiApiKey) {
            const isValid = await this.configManager.hasValidGeminiKey();
            if (!isValid) {
              void vscode.window.showErrorMessage('Invalid Gemini API key');
              this.logger.warn('Invalid Gemini API key provided');
              return;
            }
          }

          await this.configManager.updateSettings(message.settings);
          void vscode.window.showInformationMessage('Settings updated successfully');
          this.logger.info('Settings updated successfully');
          break;
        }
        case 'getSettings': {
          const settings = await this.configManager.getAllSettings();
          if (this.panel) {
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
          this.logger.warn(`Unknown message type received: ${message.type}`);
          break;
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

  private getWebviewContent(settings: Settings): string {
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
                        const message = event.data;
                        if (message.type === 'settingsLoaded') {
                            const settings = message.settings;
                            if (settings.geminiApiKey) {
                                document.getElementById('geminiApiKey').value = settings.geminiApiKey;
                            }
                            if (settings.defaultModel) {
                                document.getElementById('defaultModel').value = settings.defaultModel;
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
    this.panel?.dispose();
    this.logger.info('Settings webview disposed');
  }
}
