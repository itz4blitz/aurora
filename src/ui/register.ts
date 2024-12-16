import * as vscode from 'vscode';
import { UIManager } from './UIManager';
import { WebviewProvider } from './WebviewProvider';
import { StatusService } from '../services/StatusService';
import { CodeBlockRenderer } from './CodeBlockRenderer';
import { IncrementalCodeView } from './IncrementalCodeView';

export function registerUI(context: vscode.ExtensionContext): void {
  // Initialize all UI-related services
  WebviewProvider.initialize(context);
  StatusService.getInstance();
  CodeBlockRenderer.getInstance();
  IncrementalCodeView.getInstance();

  // Initialize and configure UI Manager
  const uiManager = UIManager.initialize(context);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'aurora.showCodeSuggestion',
      async (code: string, language: string) => {
        await uiManager.showCodeSuggestion(code, language);
      }
    ),

    vscode.commands.registerCommand(
      'aurora.showDiff',
      async (original: string, modified: string) => {
        await uiManager.showDiff(original, modified);
      }
    )
  );

  // Register theme change handler
  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme(async () => {
      await uiManager.updateTheme();
    })
  );
}
