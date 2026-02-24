/**
 * Action Registry - manages all available actions
 */

import type { Action, ActionConfig, ActionResult, Payment } from '../types';
import { logger } from '../utils/logger';

import { ConsoleAction } from './console';
import { FileAction } from './file';
import { SQLiteAction } from './sqlite';
import { WebhookAction } from './webhook';
import { SessionSendAction } from './session-send';
import { EmailAction } from './email';

const actionRegistry = new Map<string, new () => Action>();

export function registerBuiltinActions() {
  actionRegistry.set('console', ConsoleAction);
  actionRegistry.set('file', FileAction);
  actionRegistry.set('sqlite', SQLiteAction);
  actionRegistry.set('webhook', WebhookAction);
  actionRegistry.set('session_send', SessionSendAction);
  actionRegistry.set('email', EmailAction);
}

export function registerAction(type: string, ActionClass: new () => Action) {
  actionRegistry.set(type, ActionClass);
  logger.info(`Registered custom action: ${type}`);
}

export async function createAction(config: ActionConfig): Promise<Action | null> {
  const ActionClass = actionRegistry.get(config.type);
  
  if (!ActionClass) {
    logger.warn(`Unknown action type: ${config.type}`);
    return null;
  }

  try {
    const action = new ActionClass();
    await action.init(config);
    return action;
  } catch (error: any) {
    logger.error(`Failed to initialize action ${config.type}: ${error.message}`);
    return null;
  }
}

export class ActionPipeline {
  private actions: Action[] = [];

  async init(configs: ActionConfig[]) {
    registerBuiltinActions();

    for (const config of configs) {
      if (config.enabled === false) {
        logger.debug(`Skipping disabled action: ${config.type}`);
        continue;
      }

      const action = await createAction(config);
      if (action) {
        this.actions.push(action);
      }
    }
  }

  async execute(payment: Payment): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const action of this.actions) {
      try {
        const result = await action.execute(payment);
        results.push(result);

        if (!result.success) {
          logger.error(`✗ ${action.name}: ${result.error}`);
        }
      } catch (error: any) {
        logger.error(`✗ ${action.name} threw error: ${error.message}`);
        results.push({
          success: false,
          action: action.name,
          error: error.message,
        });
      }
    }

    return results;
  }

  async shutdown() {
    for (const action of this.actions) {
      try {
        await action.shutdown();
      } catch (error: any) {
        logger.error(`Error shutting down ${action.name}: ${error.message}`);
      }
    }
  }
}
