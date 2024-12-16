import * as vscode from 'vscode';
import { Logger } from '@utils/Logger';
import { ErrorManager } from '@error/ErrorManager';
import { ErrorSeverity } from '@/types';
import { ConfigManager } from '@config/ConfigManager';

interface ScrapedResponse {
  code: string;
  explanation: string;
  metadata: {
    timestamp: number;
    responseId: string;
  };
}

interface O1ProScriptMessage {
  type: 'o1proScriptInjected' | 'o1proResponse';
  content?: string;
  metadata?: {
    timestamp: number;
    responseId: string;
  };
  timestamp?: number;
}

export class O1ProService {
  private static instance: O1ProService;
  private readonly logger: Logger;
  private readonly errorManager: ErrorManager;
  private readonly configManager: ConfigManager;
  private readonly INJECTION_TIMEOUT = 5000;
  private readonly RESPONSE_TIMEOUT = 30000;
  private currentWebview: vscode.Webview | null = null;

  private constructor() {
    this.logger = Logger.getInstance();
    this.errorManager = ErrorManager.getInstance();
    this.configManager = ConfigManager.getInstance();
  }

  public static getInstance(): O1ProService {
    if (!O1ProService.instance) {
      O1ProService.instance = new O1ProService();
    }
    return O1ProService.instance;
  }

  public setWebview(webview: vscode.Webview): void {
    this.currentWebview = webview;
  }

  async generateResponse(prompt: string): Promise<string> {
    try {
      if (!(await this.configManager.isO1ProSessionActive())) {
        throw new Error('O1Pro session is not active');
      }

      if (!this.currentWebview) {
        throw new Error('Webview not initialized');
      }

      this.simulateUserInput(this.currentWebview, prompt);
      const response = await this.parseResponse(this.currentWebview);

      if (!response) {
        throw new Error('Failed to get response from O1Pro');
      }

      return `${response.code}\n\n${response.explanation}`;
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'O1ProService.generateResponse',
        ErrorSeverity.Error
      );
      throw error;
    }
  }

  public async injectScrapingScript(webview: vscode.Webview): Promise<boolean> {
    try {
      const script = `
                (function() {
                    if (window.__o1proObserver) return;
                    
                    const observer = new MutationObserver((mutations) => {
                        for (const mutation of mutations) {
                            if (mutation.type === 'childList') {
                                const responses = document.querySelectorAll('.o1pro-response');
                                if (responses.length > 0) {
                                    const latestResponse = responses[responses.length - 1];
                                    const text = latestResponse.textContent;
                                    if (text) {
                                        window.vscode.postMessage({
                                            type: 'o1proResponse',
                                            content: text,
                                            metadata: {
                                                timestamp: Date.now(),
                                                responseId: latestResponse.id
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    });

                    observer.observe(document.body, {
                        childList: true,
                        subtree: true
                    });

                    window.__o1proObserver = observer;
                    window.__o1proInjected = true;
                    
                    window.vscode.postMessage({
                        type: 'o1proScriptInjected',
                        timestamp: Date.now()
                    });
                })();
            `;

      await webview.postMessage({ type: 'executeScript', script });

      return new Promise<boolean>((resolve, reject): void => {
        const timeout = setTimeout(() => {
          reject(new Error('Script injection timeout'));
        }, this.INJECTION_TIMEOUT);

        const handler = (message: O1ProScriptMessage): void => {
          if (message.type === 'o1proScriptInjected') {
            clearTimeout(timeout);
            this.logger.info('O1Pro scraping script injected successfully');
            resolve(true);
          }
        };

        webview.onDidReceiveMessage(handler);
      });
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'O1ProService.injectScrapingScript',
        ErrorSeverity.Error
      );
      return false;
    }
  }

  public async parseResponse(webview: vscode.Webview): Promise<ScrapedResponse | null> {
    try {
      return new Promise<ScrapedResponse>((resolve, reject): void => {
        const timeout = setTimeout(() => {
          reject(new Error('Response parsing timeout'));
        }, this.RESPONSE_TIMEOUT);

        const handler = (message: O1ProScriptMessage): void => {
          if (message.type === 'o1proResponse' && message.content) {
            clearTimeout(timeout);

            const response: ScrapedResponse = {
              code: this.extractCodeBlocks(message.content),
              explanation: this.extractExplanation(message.content),
              metadata: message.metadata || {
                timestamp: Date.now(),
                responseId: `response-${Date.now()}`,
              },
            };

            this.logger.info('Successfully parsed O1Pro response');
            resolve(response);
          }
        };

        webview.onDidReceiveMessage(handler);
      });
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'O1ProService.parseResponse',
        ErrorSeverity.Error
      );
      return null;
    }
  }

  private simulateUserInput(webview: vscode.Webview, text: string): void {
    const script = `
            (function() {
                const inputArea = document.querySelector('.o1pro-input');
                if (inputArea) {
                    inputArea.value = ${JSON.stringify(text)};
                    inputArea.dispatchEvent(new Event('input'));
                    document.querySelector('.o1pro-submit').click();
                }
            })();
        `;

    void webview.postMessage({ type: 'executeScript', script });
  }

  private extractCodeBlocks(content: string): string {
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    const matches = [...content.matchAll(codeBlockRegex)];
    return matches.map((match) => match[1].trim()).join('\n\n');
  }

  private extractExplanation(content: string): string {
    // Remove code blocks to get the explanation text
    return content.replace(/```(?:\w+)?\n[\s\S]*?```/g, '').trim();
  }

  public dispose(): void {
    if (this.currentWebview) {
      const script = `
                if (window.__o1proObserver) {
                    window.__o1proObserver.disconnect();
                    delete window.__o1proObserver;
                    delete window.__o1proInjected;
                }
            `;
      void this.currentWebview.postMessage({ type: 'executeScript', script });
      this.currentWebview = null;
    }

    O1ProService.instance = undefined as unknown as O1ProService;
    this.logger.info('O1Pro service disposed');
  }
}

export default O1ProService;
