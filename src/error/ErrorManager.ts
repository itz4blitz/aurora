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
        // Log error
        this.logger.error(`[${context}] ${error.message}`, error);

        // Track telemetry
        await this.trackError(error, context);

        // Show user-friendly message
        this.showUserMessage(error, severity);
    }

    private showUserMessage(error: Error, severity: ErrorSeverity): void {
        const message = `Aurora AI: ${error.message}`;
        switch (severity) {
            case ErrorSeverity.Info:
                vscode.window.showInformationMessage(message);
                break;
            case ErrorSeverity.Warning:
                vscode.window.showWarningMessage(message);
                break;
            case ErrorSeverity.Error:
            case ErrorSeverity.Critical:
                vscode.window.showErrorMessage(message);
                break;
        }
    }

    private async trackError(error: Error, context: string): Promise<void> {
        // TODO: Implement telemetry
        // For now, just log
        this.logger.debug(`[Telemetry] Error in ${context}: ${error.message}`);
    }
}

// Usage example:
export async function handleOperationWithError(): Promise<void> {
    try {
        // some operation
        throw new Error('Test error');
    } catch (error) {
        await ErrorManager.getInstance().handleError(
            error as Error,
            'TestOperation',
            ErrorSeverity.Warning
        );
    }
}