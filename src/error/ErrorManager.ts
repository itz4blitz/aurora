import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';
import { ErrorSeverity } from '../types';

export class ErrorManager {
  private static instance: ErrorManager;
  private readonly logger: Logger;

  private constructor() {
    this.logger = Logger.getInstance();
  }

  public static getInstance(): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager();
    }
    return ErrorManager.instance;
  }

  async handleError(error: Error, context: string, severity: ErrorSeverity): Promise<void> {
    this.logger.error(`Error in ${context}: ${error.message}`, error);
    this.showUserMessage(error, severity);

    if (severity === ErrorSeverity.Critical) {
      await this.notifyCriticalError(error, context);
    }
  }

  private async notifyCriticalError(error: Error, context: string): Promise<void> {
    this.logger.error(`Critical error in ${context}`, error);

    const selection = await vscode.window.showErrorMessage(
      'A critical error has occurred. Would you like to view the logs?',
      'View Logs',
      'Dismiss'
    );

    if (selection === 'View Logs') {
      this.logger.show();
    }
  }

  private showUserMessage(error: Error, severity: ErrorSeverity): void {
    const message = `Aurora AI: ${error.message}`;

    switch (severity) {
      case ErrorSeverity.Info:
        void vscode.window.showInformationMessage(message);
        break;
      case ErrorSeverity.Warning:
        void vscode.window.showWarningMessage(message);
        break;
      case ErrorSeverity.Error:
      case ErrorSeverity.Critical:
        void vscode.window.showErrorMessage(message);
        break;
    }
  }

  public dispose(): void {
    ErrorManager.instance = null as unknown as ErrorManager;
  }
}
