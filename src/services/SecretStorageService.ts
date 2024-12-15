import * as vscode from 'vscode';

export class SecretStorageService {
    private static instance: SecretStorageService;
    
    private constructor(
        private secretStorage: vscode.SecretStorage
    ) {}

    static initialize(secretStorage: vscode.SecretStorage): SecretStorageService {
        if (!SecretStorageService.instance) {
            SecretStorageService.instance = new SecretStorageService(secretStorage);
        }
        return SecretStorageService.instance;
    }

    static getInstance(): SecretStorageService {
        if (!SecretStorageService.instance) {
            throw new Error('SecretStorageService must be initialized first');
        }
        return SecretStorageService.instance;
    }

    async getGeminiKey(): Promise<string> {
        const key = await this.secretStorage.get('geminiKey');
        return key ?? '';
    }

    async storeGeminiKey(key: string): Promise<void> {
        await this.secretStorage.store('geminiKey', key);
    }

    async getOpenAIKey(): Promise<string> {
        const key = await this.secretStorage.get('openAIKey');
        return key ?? '';
    }

    async setOpenAIKey(key: string): Promise<void> {
        await this.secretStorage.store('openAIKey', key);
    }

    async getAnthropicKey(): Promise<string> {
        const key = await this.secretStorage.get('anthropicKey');
        return key ?? '';
    }

    async setAnthropicKey(key: string): Promise<void> {
        await this.secretStorage.store('anthropicKey', key);
    }

    async validateGeminiKey(key: string): Promise<boolean> {
        // Implementation
        return true; // TODO: Implement actual validation
    }

    async validateOpenAIKey(key: string): Promise<boolean> {
        // Implementation
        return true; // TODO: Implement actual validation
    }

    async validateAnthropicKey(key: string): Promise<boolean> {
        // Implementation
        return true; // TODO: Implement actual validation
    }

    async getO1ProSessionState(): Promise<boolean> {
        const state = await this.secretStorage.get('o1proSession');
        return state === 'active';
    }

    async setO1ProSessionState(active: boolean): Promise<void> {
        await this.secretStorage.store('o1proSession', active ? 'active' : 'inactive');
    }

    async deleteGeminiKey(): Promise<void> {
        await this.secretStorage.delete('geminiKey');
    }
} 