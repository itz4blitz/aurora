import * as vscode from 'vscode';
import { GeminiService } from './GeminiService';
import { OpenAIService } from './OpenAIService';
import { AnthropicService } from './AnthropicService';

export class SecretStorageService {
  private static instance: SecretStorageService;
  private readonly geminiService: GeminiService;
  private readonly openAIService: OpenAIService;
  private readonly anthropicService: AnthropicService;

  private constructor(private secretStorage: vscode.SecretStorage) {
    this.geminiService = GeminiService.getInstance();
    this.openAIService = OpenAIService.getInstance();
    this.anthropicService = AnthropicService.getInstance();
  }

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

  async validateGeminiKey(): Promise<boolean> {
    const apiKey = await this.getGeminiKey();
    if (!apiKey) return false;
    return await this.geminiService.validateApiKey(apiKey);
  }

  async validateOpenAIKey(): Promise<boolean> {
    const apiKey = await this.getOpenAIKey();
    if (!apiKey) return false;
    return await this.openAIService.validateApiKey(apiKey);
  }

  async validateAnthropicKey(): Promise<boolean> {
    const apiKey = await this.getAnthropicKey();
    if (!apiKey) return false;
    return await this.anthropicService.validateApiKey(apiKey);
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
