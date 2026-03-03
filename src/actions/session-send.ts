/**
 * SessionSend action - notify via OpenClaw CLI
 */

import { BaseAction } from './base';
import type { ActionConfig, ActionResult, Payment } from '../types';
import { logger } from '../utils/logger';

export class SessionSendAction extends BaseAction {
  private channel: string;
  private target: string;
  private template: string;

  constructor(config: ActionConfig) {
    super(config);
    this.channel = (config.channel as string) || 'whatsapp';
    this.target = config.target as string;
    this.template = (config.template as string) || 
      '⚡ Payment received on {wallet}: {amount_sats} sats - {description}';

    if (!this.target) {
      throw new Error('SessionSendAction requires "target" (phone number or chat id)');
    }
  }

  private async resolveOpenclaw(): Promise<string> {
    const candidates = [
      '/home/linuxbrew/.linuxbrew/bin/openclaw',
      '/home/agustin/.npm-global/bin/openclaw',
    ];
    for (const path of candidates) {
      try {
        const file = Bun.file(path);
        if (await file.exists()) return path;
      } catch { /* skip */ }
    }
    return 'openclaw'; // fallback to PATH
  }

  async execute(payment: Payment): Promise<ActionResult> {
    const message = this.replaceTemplates(this.template, payment);

    try {
      // Resolve openclaw binary — prefer linuxbrew (latest), fallback to PATH
      const openclawBin = await this.resolveOpenclaw();
      const proc = Bun.spawn(
        [openclawBin, 'message', 'send', '--channel', this.channel, '--target', this.target, '--message', message],
        { stdout: 'pipe', stderr: 'pipe', timeout: 15000 }
      );

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        throw new Error(`openclaw CLI exited with code ${exitCode}: ${stderr}`);
      }

      logger.info(`Notified ${this.target} via ${this.channel}`);
      return this.success();
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }
}
