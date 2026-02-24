// Email action - send payment notifications via SMTP

import { BaseAction } from './base';
import type { ActionResult, Payment } from '../types';
import { logger } from '../utils/logger';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export class EmailAction extends BaseAction {
  private smtp: SmtpConfig | null = null;
  private to: string = '';
  private from: string = '';
  private subjectTemplate: string = '⚡ Payment Received: {amount_sats} sats';
  private bodyTemplate: string = `
Payment Details:
- Wallet: {wallet}
- Amount: {amount_sats} sats
- Type: {type}
- Description: {description}
- Payment Hash: {payment_hash}
- Settled At: {settled_at}
`;

  constructor() {
    super('email');
  }

  async init(config: any): Promise<void> {
    await super.init(config);
    
    if (!config.smtp) {
      throw new Error('Email action requires "smtp" config');
    }
    
    if (!config.to) {
      throw new Error('Email action requires "to" field');
    }
    
    this.smtp = config.smtp;
    this.to = config.to;
    this.from = config.from || config.smtp.user;
    
    if (config.subject_template) {
      this.subjectTemplate = config.subject_template;
    }
    
    if (config.body_template) {
      this.bodyTemplate = config.body_template;
    }
    
    logger.debug(`Email initialized: ${this.smtp.host}:${this.smtp.port} -> ${this.to}`);
  }

  async execute(payment: Payment): Promise<ActionResult> {
    if (!this.smtp) {
      return this.failure('SMTP not configured');
    }
    
    try {
      const subject = this.applyTemplate(this.subjectTemplate, payment);
      const body = this.applyTemplate(this.bodyTemplate, payment);
      
      // Use native SMTP client (simplified for Bun)
      // In production, you might want to use a library like nodemailer
      const result = await this.sendEmail(subject, body);
      
      return this.success({ to: this.to, subject });
    } catch (error) {
      return this.failure(error as Error);
    }
  }

  private async sendEmail(subject: string, body: string): Promise<void> {
    const { host, port, secure, user, pass } = this.smtp!;
    
    // Create SMTP connection
    const socket = secure
      ? await Bun.connect({
          hostname: host,
          port,
          socket: {
            data: () => {},
            open: () => {},
            close: () => {},
            drain: () => {},
            error: () => {},
          },
          tls: true,
        })
      : await Bun.connect({
          hostname: host,
          port,
          socket: {
            data: () => {},
            open: () => {},
            close: () => {},
            drain: () => {},
            error: () => {},
          },
        });
    
    // Basic SMTP conversation
    const commands = [
      `EHLO localhost\r\n`,
      `AUTH LOGIN\r\n`,
      `${Buffer.from(user).toString('base64')}\r\n`,
      `${Buffer.from(pass).toString('base64')}\r\n`,
      `MAIL FROM:<${this.from}>\r\n`,
      `RCPT TO:<${this.to}>\r\n`,
      `DATA\r\n`,
      `Subject: ${subject}\r\n`,
      `From: ${this.from}\r\n`,
      `To: ${this.to}\r\n`,
      `\r\n`,
      `${body}\r\n`,
      `.\r\n`,
      `QUIT\r\n`,
    ];
    
    for (const cmd of commands) {
      socket.write(cmd);
      await Bun.sleep(100);
    }
    
    socket.end();
    
    logger.debug(`Email sent to ${this.to}: ${subject}`);
  }
}
