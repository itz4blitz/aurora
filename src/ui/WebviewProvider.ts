import * as vscode from 'vscode';
import { codeBlockStyles, copyScript } from './styles/codeBlock';

export class WebviewProvider {
    private static instance: WebviewProvider;
    
    private constructor(
        private readonly context: vscode.ExtensionContext
    ) {}

    public static initialize(context: vscode.ExtensionContext): WebviewProvider {
        if (!WebviewProvider.instance) {
            WebviewProvider.instance = new WebviewProvider(context);
        }
        return WebviewProvider.instance;
    }

    public static getInstance(): WebviewProvider {
        if (!WebviewProvider.instance) {
            throw new Error('WebviewProvider must be initialized with context first');
        }
        return WebviewProvider.instance;
    }

    getWebviewContent(content: string): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    ${codeBlockStyles}
                </style>
            </head>
            <body>
                <div class="content">
                    ${content}
                </div>
                <script>
                    ${copyScript}
                </script>
            </body>
            </html>
        `;
    }

    dispose(): void {
        WebviewProvider.instance = null as unknown as WebviewProvider;
    }
} 