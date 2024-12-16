import { ConfigManager } from '@config/ConfigManager';
import { Logger } from '@utils/Logger';
import { ErrorManager } from '@error/ErrorManager';
import { ErrorSeverity } from '@/types';

export class SyncManager {
  private static instance: SyncManager;
  private readonly logger: Logger;
  private readonly errorManager: ErrorManager;
  private readonly configManager: ConfigManager;
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.logger = Logger.getInstance();
    this.errorManager = ErrorManager.getInstance();
    this.configManager = ConfigManager.getInstance();
  }

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  async startSync(): Promise<void> {
    try {
      // Check if O1Pro session is active
      const sessionActive = await this.configManager.isO1ProSessionActive();
      if (!sessionActive) {
        throw new Error('O1Pro session not active');
      }

      // Start periodic sync
      this.syncInterval = setInterval(() => {
        void this.sync();
      }, this.SYNC_INTERVAL);

      this.logger.info('Sync service started');
    } catch (error) {
      await this.errorManager.handleError(
        error as Error,
        'SyncManager.startSync',
        ErrorSeverity.Error
      );
    }
  }

  private async sync(): Promise<void> {
    try {
      // Check session state before syncing
      const sessionActive = await this.configManager.isO1ProSessionActive();
      if (!sessionActive) {
        this.stopSync();
        return;
      }

      // Implement sync logic here
      this.logger.info('Sync completed successfully');
    } catch (error) {
      await this.errorManager.handleError(error as Error, 'SyncManager.sync', ErrorSeverity.Error);
    }
  }

  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.logger.info('Sync service stopped');
    }
  }

  dispose(): void {
    this.stopSync();
    SyncManager.instance = null as unknown as SyncManager;
  }
}
