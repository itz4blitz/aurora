import * as vscode from 'vscode';
import * as diff from 'diff-match-patch';
import { DiffChange } from '../types';
import { Logger } from '../utils/Logger';
import { ErrorManager } from '../error/ErrorManager';
import { ErrorSeverity } from '../types';

export class DiffService {
  private static instance: DiffService;
  private dmp: InstanceType<typeof diff.diff_match_patch>;
  private logger: Logger;
  private errorManager: ErrorManager;

  private constructor() {
    this.dmp = new diff.diff_match_patch();
    this.logger = Logger.getInstance();
    this.errorManager = ErrorManager.getInstance();
  }

  public static getInstance(): DiffService {
    if (!DiffService.instance) {
      DiffService.instance = new DiffService();
    }
    return DiffService.instance;
  }

  async computeDiffs(original: string, suggested: string): Promise<DiffChange[]> {
    try {
      this.logger.debug('Computing diffs between original and suggested text');
      const diffs = this.dmp.diff_main(original, suggested);
      this.dmp.diff_cleanupSemantic(diffs);

      const changes = this.convertToRangedDiffs(diffs, original);
      this.logger.debug(`Generated ${changes.length} diff changes`);
      return changes;
    } catch (error) {
      this.logger.error('Error computing diffs', error as Error);
      await this.errorManager.handleError(
        error as Error,
        'DiffService.computeDiffs',
        ErrorSeverity.Error
      );
      return [];
    }
  }

  private convertToRangedDiffs(diffs: diff.Diff[], original: string): DiffChange[] {
    this.logger.debug('Converting diffs to ranged changes');
    let currentPos = 0;
    const changes: DiffChange[] = [];

    for (const [operation, text] of diffs) {
      if (operation !== 0) {
        // If not EQUAL
        const range = new vscode.Range(
          this.positionAt(currentPos, original),
          this.positionAt(currentPos + (operation === -1 ? text.length : 0), original)
        );

        changes.push({
          original: operation === -1 ? text : '',
          suggested: operation === 1 ? text : '',
          range,
          status: 'pending',
        });
      }

      if (operation !== 1) {
        // If not INSERT
        currentPos += text.length;
      }
    }

    this.logger.debug(`Converted ${changes.length} diffs to ranged changes`);
    return changes;
  }

  private positionAt(offset: number, text: string): vscode.Position {
    const lines = text.slice(0, offset).split('\n');
    return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
  }

  getDecorationTypes(): Record<string, vscode.TextEditorDecorationType> {
    this.logger.debug('Creating decoration types for diff display');
    return {
      pending: vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
        border: '1px dashed green',
      }),
      accepted: vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
        border: '1px solid green',
      }),
      rejected: vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('diffEditor.removedTextBackground'),
        border: '1px solid red',
        textDecoration: 'line-through',
      }),
    };
  }
}
