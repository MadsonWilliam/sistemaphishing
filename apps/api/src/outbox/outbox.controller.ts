import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { OutboxStatus, Role } from '@prisma/client';
import { OutboxService } from './outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { DripTestDto } from './dto/outbox.dto';

@Roles(Role.SUPER_ADMIN)
@Controller('outbox')
export class OutboxController {
  constructor(
    private readonly outbox: OutboxService,
    private readonly prisma: PrismaService,
  ) {}

  // Enfileira um lote de teste (valida o motor gota-a-gota + agendador).
  @Post('drip-test')
  async dripTest(@Body() dto: DripTestDto) {
    const identity = await this.prisma.senderIdentity.findUnique({
      where: { id: dto.senderIdentityId },
    });
    if (!identity) {
      throw new BadRequestException('Identidade de remetente inexistente.');
    }
    return this.outbox.enqueueDrip(
      dto.toEmails.map((toEmail) => ({
        senderIdentityId: dto.senderIdentityId,
        companyId: dto.companyId ?? null,
        toEmail,
        subject: dto.subject,
        html: dto.html,
      })),
      {
        windowSeconds: dto.windowSeconds ?? 0,
        jitterSeconds: dto.jitterSeconds ?? 0,
      },
    );
  }

  // Lista a fila (opcionalmente por status) — visão operacional.
  @Get()
  list(@Query('status') status?: string) {
    const where =
      status && (Object.values(OutboxStatus) as string[]).includes(status)
        ? { status: status as OutboxStatus }
        : {};
    return this.prisma.emailOutbox.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      take: 200,
      select: {
        id: true,
        toEmail: true,
        subject: true,
        status: true,
        attempts: true,
        scheduledAt: true,
        sentAt: true,
        lastError: true,
      },
    });
  }

  // Contadores por status (para a dashboard futura).
  @Get('stats')
  async stats() {
    const grouped = await this.prisma.emailOutbox.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return grouped.reduce<Record<string, number>>((acc, g) => {
      acc[g.status] = g._count._all;
      return acc;
    }, {});
  }
}
