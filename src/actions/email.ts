/**
 * Email action - send payment notification via SMTP
 * Uses raw TCP/TLS sockets (no external dependencies)
 */

import { BaseAction } from './base';
import type { ActionConfig, ActionResult, Payment } from '../types';
import { logger } from '../utils/logger';
import * as net from 'net';
import * as tls from 'tls';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export class EmailAction extends BaseAction {
  private smtp: SmtpConfig;
  private from: string;
  private to: string;
  private subjectTemplate: string;
  private bodyTemplate: string;

  constructor(config: ActionConfig) {
    super(config);

    const smtp = config.smtp as any;
    if (!smtp || !smtp.host) {
      throw new Error('EmailAction requires "smtp" config with host');
    }

    this.smtp = {
      host: smtp.host,
      port: smtp.port || (smtp.secure ? 465 : 587),
      secure: smtp.secure ?? true,
      user: smtp.user,
      pass: smtp.pass,
    };

    this.from = (config.from as string) || this.smtp.user;
    this.to = config.to as string;
    this.subjectTemplate = (config.subject_template as string) || '⚡ Payment: {amount_sats} sats on {wallet}';
    this.bodyTemplate = (config.body_template as string) ||
      'Payment received on wallet "{wallet}"\n\nAmount: {amount_sats} sats\nDescription: {description}\nHash: {payment_hash}\nTime: {settled_at}';

    if (!this.to) {
      throw new Error('EmailAction requires "to" config');
    }
    if (!this.smtp.user || !this.smtp.pass) {
      throw new Error('EmailAction requires smtp.user and smtp.pass');
    }
  }

  async execute(payment: Payment): Promise<ActionResult> {
    try {
      const subject = this.replaceTemplates(this.subjectTemplate, payment);
      const body = this.replaceTemplates(this.bodyTemplate, payment);

      await this.sendEmail(subject, body);
      logger.info(`Email sent to ${this.to}: ${subject}`);
      return this.success({ to: this.to, subject });
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }

  private async sendEmail(subject: string, body: string): Promise<void> {
    // Use Bun's built-in fetch to send via a simple approach
    // For Gmail SMTP, use the net/tls approach
    const message = [
      `From: ${this.from}`,
      `To: ${this.to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Date: ${new Date().toUTCString()}`,
      '',
      body,
    ].join('\r\n');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('SMTP timeout')), 15000);

      const commands: string[] = [];
      let step = 0;

      const processResponse = (data: string) => {
        const code = parseInt(data.substring(0, 3));
        logger.debug(`SMTP [${step}]: ${data.trim()}`);

        if (code >= 400) {
          cleanup();
          reject(new Error(`SMTP error at step ${step}: ${data.trim()}`));
          return;
        }

        step++;
        switch (step) {
          case 1: // After connect greeting
            socket.write(`EHLO localhost\r\n`);
            break;
          case 2: // After EHLO
            if (!this.smtp.secure) {
              socket.write(`STARTTLS\r\n`);
            } else {
              socket.write(`AUTH LOGIN\r\n`);
            }
            break;
          case 3: // After AUTH LOGIN
            socket.write(Buffer.from(this.smtp.user).toString('base64') + '\r\n');
            break;
          case 4: // After username
            socket.write(Buffer.from(this.smtp.pass).toString('base64') + '\r\n');
            break;
          case 5: // After auth success
            socket.write(`MAIL FROM:<${this.from}>\r\n`);
            break;
          case 6: // After MAIL FROM
            socket.write(`RCPT TO:<${this.to}>\r\n`);
            break;
          case 7: // After RCPT TO
            socket.write(`DATA\r\n`);
            break;
          case 8: // After DATA
            socket.write(message + '\r\n.\r\n');
            break;
          case 9: // After message sent
            socket.write(`QUIT\r\n`);
            clearTimeout(timeout);
            resolve();
            break;
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        try { socket.end(); } catch {}
      };

      let socket: net.Socket | tls.TLSSocket;

      if (this.smtp.secure) {
        socket = tls.connect(this.smtp.port, this.smtp.host, { rejectUnauthorized: true }, () => {
          // TLS connected, wait for greeting
        });
      } else {
        socket = net.connect(this.smtp.port, this.smtp.host);
      }

      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.length > 0) {
            // Multi-line responses: 250-... are continuations, 250 ... is final
            // Only process the final line of multi-line responses
            if (line.length >= 4 && line[3] === '-') {
              logger.debug(`SMTP continuation: ${line.trim()}`);
              continue;
            }
            processResponse(line);
          }
        }
      });

      socket.on('error', (err) => {
        cleanup();
        reject(err);
      });
    });
  }
}
