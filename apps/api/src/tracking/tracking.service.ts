import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PostClickBehavior,
  TrackingEventType,
  CampaignTarget,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  blankPage,
  educationalPage,
  fakeFormPage,
  reportedPage,
} from './landing.templates';

// GIF transparente de 1x1 para o pixel de abertura.
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

interface ReqMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  readonly pixel = PIXEL;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async findTarget(token: string) {
    return this.prisma.campaignTarget.findUnique({
      where: { token },
      include: { campaign: true },
    });
  }

  // Registra o evento e atualiza o "primeiro X em" do alvo (idempotente por tipo).
  private async record(
    target: CampaignTarget,
    type: TrackingEventType,
    meta: ReqMeta,
    firstField?: keyof CampaignTarget,
  ) {
    await this.prisma.trackingEvent.create({
      data: {
        targetId: target.id,
        type,
        ip: meta.ip?.slice(0, 64),
        userAgent: meta.userAgent?.slice(0, 300),
      },
    });
    if (firstField && !target[firstField]) {
      await this.prisma.campaignTarget.update({
        where: { id: target.id },
        data: { [firstField]: new Date() },
      });
    }
  }

  async trackOpen(token: string, meta: ReqMeta): Promise<Buffer> {
    const target = await this.findTarget(token);
    if (target) {
      await this.record(target, TrackingEventType.OPENED, meta, 'openedAt');
    }
    return this.pixel;
  }

  // Clique em link (ou "abertura de anexo"): registra e devolve a landing.
  async trackClick(
    token: string,
    meta: ReqMeta,
    asAttachment = false,
  ): Promise<{ redirectUrl?: string; html: string }> {
    const target = await this.findTarget(token);
    if (!target) {
      return { html: blankPage() };
    }
    await this.record(
      target,
      asAttachment
        ? TrackingEventType.ATTACHMENT_OPENED
        : TrackingEventType.CLICKED,
      meta,
      'clickedAt',
    );

    const c = target.campaign;
    if (c.landingRedirectUrl) {
      return { redirectUrl: c.landingRedirectUrl, html: '' };
    }
    switch (c.postClickBehavior) {
      case PostClickBehavior.BLANK:
        return { html: blankPage() };
      case PostClickBehavior.FORM:
        return {
          html: fakeFormPage({
            token,
            actionBase: this.config.getOrThrow<string>('APP_BASE_URL'),
          }),
        };
      case PostClickBehavior.EDUCATIONAL:
      default:
        return { html: educationalPage({ microTraining: c.microTraining }) };
    }
  }

  // Submissão do formulário falso. Os valores enviados são IGNORADOS de propósito.
  async trackFormSubmit(token: string, meta: ReqMeta): Promise<string> {
    const target = await this.findTarget(token);
    if (!target) return blankPage();
    await this.record(
      target,
      TrackingEventType.FORM_SUBMITTED,
      meta,
      'submittedAt',
    );
    return educationalPage({ microTraining: target.campaign.microTraining });
  }

  // Reporte de phishing (comportamento positivo).
  async trackReport(token: string, meta: ReqMeta): Promise<string> {
    const target = await this.findTarget(token);
    if (!target) return blankPage();
    await this.record(target, TrackingEventType.REPORTED, meta, 'reportedAt');
    return reportedPage();
  }
}
