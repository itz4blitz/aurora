import * as vscode from 'vscode';
import { AIModel } from '../types';

export class StatusBarManager {
    private statusBarItem: vscode.StatusBarItem;
    private model: AIModel = 'gpt-3.5-turbo';

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'aurora.toggleModel';
        this.updateStatusBar();
    }

    show() {
        this.statusBarItem.show();
    }

    hide() {
        this.statusBarItem.hide();
    }

    updateModel(model: AIModel) {
        this.model = model;3
        this.updateStatusBar();
    }

    private updateStatusBar() {
        const modelIcons = {
            'gpt-3.5-turbo': '$(symbol-method)',
            'gpt-4': '$(symbol-class)',
            'gpt-4-turbo': '$(symbol-interface)',
            'gemini-pro': '$(symbol-variable)',
            'gemini-pro-vision': '$(symbol-color)',
            'claude-3-opus': '$(symbol-ruler)',
            'claude-3-sonnet': '$(symbol-keyword)',
            'claude-3-haiku': '$(symbol-enum)',
            'o1pro': '$(symbol-misc)',
        } as const;
        
        const modelNames = {
            'gpt-3.5-turbo': 'GPT-3.5',
            'gpt-4': 'GPT-4',
            'gpt-4-turbo': 'GPT-4 Turbo',
            'gemini-pro': 'Gemini Pro',
            'gemini-pro-vision': 'Gemini Vision',
            'claude-3-opus': 'Claude 3 Opus',
            'claude-3-sonnet': 'Claude 3 Sonnet',
            'claude-3-haiku': 'Claude 3 Haiku',
            'o1pro': 'O1Pro',
        } as const;

        const modelIcon = this.model.startsWith('local:') 
            ? '$(symbol-package)' 
            : modelIcons[this.model as keyof typeof modelIcons] || '$(symbol-misc)';

        const modelName = this.model.startsWith('local:')
            ? `Local: ${this.model.split(':')[1]}`
            : modelNames[this.model as keyof typeof modelNames] || this.model;
        
        this.statusBarItem.text = `${modelIcon} Aurora: ${modelName}`;
        this.statusBarItem.tooltip = `Click to switch AI model (currently using ${modelName})`;
    }

    dispose() {
        this.statusBarItem.dispose();
    }

    update(command: string) {
        const commandMap: { [key: string]: string } = {
            'toggleModel': 'Switched AI model',
            'newConversation': 'Started new conversation',
            'searchConversations': 'Searching conversations',
            'pinConversation': 'Toggled pin status',
            'starConversation': 'Toggled star status'
        };

        const message = commandMap[command] || `Executed ${command}`;
        this.statusBarItem.text = `$(symbol-event) Aurora: ${message}`;
        
        // Reset after 3 seconds
        setTimeout(() => {
            this.updateStatusBar();
        }, 3000);
    }
} 