import * as vscode from 'vscode';
import { Logger } from '../utils/Logger';

interface ProgressReport {
  message?: string | undefined;
  increment?: number | undefined;
}

export class StatusService {
  private static instance: StatusService;
  private readonly logger: Logger;
  private statusBarItem: vscode.StatusBarItem;
  private progressResolver: (() => void) | null = null;
  private activeProgress: vscode.Progress<ProgressReport> | null = null;

  private constructor() {
    this.logger = Logger.getInstance();
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  }

  public static getInstance(): StatusService {
    if (!StatusService.instance) {
      StatusService.instance = new StatusService();
    }
    return StatusService.instance;
  }

  async showProgress<T>(title: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title,
          cancellable: true,
        },
        async (progress, token) => {
          this.activeProgress = progress;
          token.onCancellationRequested(() => {
            this.progressResolver?.();
          });

          progress.report({ increment: 0 });
          const result = await operation();
          progress.report({ increment: 100 });
          return result;
        }
      );
    } finally {
      this.activeProgress = null;
      this.progressResolver = null;
    }
  }

  updateProgress(message: string, increment?: number | undefined): void {
    const report: ProgressReport = { message };
    if (increment !== undefined) {
      report.increment = increment;
    }
    this.activeProgress?.report(report);
  }

  showStatusBarMessage(message: string, timeout?: number): void {
    this.statusBarItem.text = message;
    this.statusBarItem.show();

    if (timeout) {
      setTimeout(() => {
        this.statusBarItem.hide();
      }, timeout);
    }
  }

  async showErrorMessage(message: string, ...actions: string[]): Promise<string | undefined> {
    this.logger.error(message);
    return await vscode.window.showErrorMessage(message, ...actions);
  }

  async showWarningMessage(message: string, ...actions: string[]): Promise<string | undefined> {
    this.logger.warn(message);
    return await vscode.window.showWarningMessage(message, ...actions);
  }

  async showInformationMessage(message: string, ...actions: string[]): Promise<string | undefined> {
    return await vscode.window.showInformationMessage(message, ...actions);
  }

  dispose(): void {
    this.statusBarItem.dispose();
    StatusService.instance = null as unknown as StatusService;
  }
}
