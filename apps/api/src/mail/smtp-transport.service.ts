import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { createHash } from 'crypto';
import { SendMailInput, SendMailResult, SmtpConfig } from './mail.types';

// Transporte de e-mail via SMTP (plugável por domínio). Reaproveita transporters
// por configuração para não reabrir conexão a cada envio.
@Injectable()
export class SmtpTransportService {
  private readonly logger = new Logger(SmtpTransportService.name);
  private readonly pool = new Map<string, nodemailer.Transporter>();

  private keyOf(cfg: SmtpConfig): string {
    return createHash('sha256')
      .update(`${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.username}`)
      .digest('hex');
  }

  private transporter(cfg: SmtpConfig): nodemailer.Transporter {
    const key = this.keyOf(cfg);
    let t = this.pool.get(key);
    if (!t) {
      t = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.username, pass: cfg.password },
        pool: true,
        maxConnections: 3,
        maxMessages: 100,
        // Falha rápido em porta/host ruim em vez de pendurar a requisição.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
      this.pool.set(key, t);
    }
    return t;
  }

  // Testa a conexão/credenciais SMTP sem enviar e-mail.
  async verify(cfg: SmtpConfig): Promise<void> {
    await this.transporter(cfg).verify();
  }

  async send(cfg: SmtpConfig, msg: SendMailInput): Promise<SendMailResult> {
    const info = await this.transporter(cfg).sendMail({
      from: msg.fromName
        ? `"${msg.fromName}" <${msg.fromEmail}>`
        : msg.fromEmail,
      to: msg.toName ? `"${msg.toName}" <${msg.toEmail}>` : msg.toEmail,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      headers: msg.headers,
      attachments: msg.attachments,
    });
    return {
      messageId: info.messageId,
      accepted: (info.accepted ?? []).map(String),
      rejected: (info.rejected ?? []).map(String),
    };
  }

  // Invalida o transporter em cache (ex.: após troca de credenciais do domínio).
  evict(cfg: SmtpConfig) {
    const key = this.keyOf(cfg);
    const t = this.pool.get(key);
    if (t) {
      t.close();
      this.pool.delete(key);
    }
  }
}
