import type { Action, ActionConfig, Payment } from '../types';
import { logger } from '../utils/logger';
import { ConsoleAction } from './console';
import { FileAction } from './file';
import { SqliteAction } from './sqlite';
import { WebhookAction } from './webhook';
import { SessionSendAction } from './session-send';
import { EmailAction } from './email';

type ActionConstructor = new (config: ActionConfig) => Action;
const actionRegistry = new Map<string, ActionConstructor>();

export function registerBuiltinActions(): void {
  actionRegistry.set('console', ConsoleAction);
  actionRegistry.set('file', FileAction);
  actionRegistry.set('sqlite', SqliteAction);
  actionRegistry.set('webhook', WebhookAction);
  actionRegistry.set('session-send', SessionSendAction);
  actionRegistry.set('email', EmailAction);
}

export function createAction(config: ActionConfig): Action {
  const Constructor = actionRegistry.get(config.type);
  if (!Constructor) throw new Error(`Unknown action: ${config.type}`);
  return new Constructor(config);
}

export class ActionPipeline {
  private actions: Action[];
  constructor(configs: ActionConfig[]) { this.actions = configs.map(createAction); }
  async execute(payment: Payment): Promise<void> {
    for (const action of this.actions) {
      try {
        const result = await action.execute(payment);
        if (!result.success) logger.error(`Action ${action.name} failed:`, result.error);
      } catch (error) {
        logger.error(`Action ${action.name} exception:`, error);
      }
    }
  }
}
