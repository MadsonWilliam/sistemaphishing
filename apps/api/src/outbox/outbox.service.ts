import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DomainsService } from '../domains/domains.service';
import { SmtpTransportService } from '../mail/smtp-transport.service';

export interface OutboxItem {
  senderIdentityId: string;
  companyId?: string | null;
  toEmail: string;
  toName?: string | null;
  subject: string;
  html: string;
  text?: string | null;
  campaignId?: string | null;
  campaignTargetId?: string | null;
}

export interface DripOptions {
  startAt?: Date;
  // Janela total (segundos) na qual espalhar os envios (gota-a-gota).
  windowSeconds: number;
  // Jitter aleatório (segundos) somado/subtraído do horário de cada item.
  jitterSeconds?: number;
}

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  private readonly intervalMs: number;
  private readonly maxAttempts: number;
  private readonly batchSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly domains: DomainsService,
    private readonly smtp: SmtpTransportService,
    config: ConfigService,
  ) {
    this.intervalMs = config.getOrThrow<number>('MAIL_SCHEDULER_INTERVAL_MS');
    this.maxAttempts = config.getOrThrow<number>('MAIL_MAX_ATTEMPTS');
    this.batchSize = config.getOrThrow<number>('MAIL_BATCH_SIZE');
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      this.processDue().catch((e) =>
        this.logger.error('Falha no ciclo do outbox', e),
      );
    }, this.intervalMs);
    this.logger.log(
      `Agendador de e-mail ativo (intervalo ${this.intervalMs}ms, lote ${this.batchSize}).`,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // Enfileira mensagens já com horário definido.
  async enqueue(items: (OutboxItem & { scheduledAt: Date })[]) {
    if (items.length === 0) return { enqueued: 0 };
    const data: Prisma.EmailOutboxCreateManyInput[] = items.map((i) => ({
      senderIdentityId: i.senderIdentityId,
      companyId: i.companyId ?? null,
      toEmail: i.toEmail,
      toName: i.toName ?? null,
      subject: i.subject,
      html: i.html,
      text: i.text ?? null,
      campaignId: i.campaignId ?? null,
      campaignTargetId: i.campaignTargetId ?? null,
      scheduledAt: i.scheduledAt,
    }));
    const res = await this.prisma.emailOutbox.createMany({ data });
    return { enqueued: res.count };
  }

  // Enfileira em modo gota-a-gota: espalha os itens ao longo da janela com jitter.
  async enqueueDrip(items: OutboxItem[], opts: DripOptions) {
    const start = opts.startAt ?? new Date();
    const n = items.length;
    const jitter = (opts.jitterSeconds ?? 0) * 1000;
    const window = Math.max(opts.windowSeconds, 0) * 1000;

    const scheduled = items.map((item, idx) => {
      const base = n > 1 ? (window * idx) / (n - 1) : 0;
      const rand = jitter > 0 ? (Math.random() * 2 - 1) * jitter : 0;
      const when = new Date(Math.max(Date.now(), start.getTime() + base + rand));
      return { ...item, scheduledAt: when };
    });
    return this.enqueue(scheduled);
  }

  // Processa o lote vencido. Guard contra sobreposição de ciclos.
  async processDue() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const due = await this.prisma.emailOutbox.findMany({
        where: { status: OutboxStatus.PENDING, scheduledAt: { lte: now } },
        orderBy: { scheduledAt: 'asc' },
        take: this.batchSize,
        include: { senderIdentity: { include: { domain: true } } },
      });
      if (due.length === 0) return;

      const ids = due.map((d) => d.id);
      // "Claim" atômico: só processa quem ainda está PENDING.
      await this.prisma.emailOutbox.updateMany({
        where: { id: { in: ids }, status: OutboxStatus.PENDING },
        data: { status: OutboxStatus.SENDING },
      });

      for (const msg of due) {
        await this.deliver(msg);
      }
    } finally {
      this.running = false;
    }
  }

  private async deliver(
    msg: Prisma.EmailOutboxGetPayload<{
      include: { senderIdentity: { include: { domain: true } } };
    }>,
  ) {
    const { senderIdentity } = msg;
    const domain = senderIdentity.domain;
    try {
      const cfg = this.domains.smtpConfigOf(domain);
      const fromEmail = `${senderIdentity.localPart}@${domain.domain}`;
      const result = await this.smtp.send(cfg, {
        fromEmail,
        fromName: senderIdentity.displayName,
        toEmail: msg.toEmail,
        toName: msg.toName ?? undefined,
        subject: msg.subject,
        html: msg.html,
        text: msg.text ?? undefined,
      });
      await this.prisma.emailOutbox.update({
        where: { id: msg.id },
        data: {
          status: OutboxStatus.SENT,
          sentAt: new Date(),
          attempts: { increment: 1 },
          providerMessageId: result.messageId,
          lastError: null,
        },
      });
      // Marca o alvo de campanha como enviado (evento SENT do rastreio).
      if (msg.campaignTargetId) {
        await this.prisma.trackingEvent.create({
          data: { targetId: msg.campaignTargetId, type: 'SENT' },
        });
        await this.prisma.campaignTarget.updateMany({
          where: { id: msg.campaignTargetId, sentAt: null },
          data: { sentAt: new Date() },
        });
      }
    } catch (err) {
      const attempts = msg.attempts + 1;
      const message = err instanceof Error ? err.message : 'Falha no envio';
      if (attempts >= this.maxAttempts) {
        await this.prisma.emailOutbox.update({
          where: { id: msg.id },
          data: {
            status: OutboxStatus.FAILED,
            attempts,
            lastError: message.slice(0, 500),
          },
        });
      } else {
        // Backoff exponencial (30s, 60s, 120s, ...) até 1h.
        const backoffMs = Math.min(2 ** attempts * 30_000, 3_600_000);
        await this.prisma.emailOutbox.update({
          where: { id: msg.id },
          data: {
            status: OutboxStatus.PENDING,
            attempts,
            lastError: message.slice(0, 500),
            scheduledAt: new Date(Date.now() + backoffMs),
          },
        });
      }
    }
  }
}
