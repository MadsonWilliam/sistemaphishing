import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, SendCampaignDto } from './dto/campaign.dto';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';

// COMPANY_ADMIN só enxerga (escopado à própria empresa); SUPER_ADMIN faz tudo.
function scopeOf(user: AuthUser): string | undefined {
  return user.role === Role.SUPER_ADMIN ? undefined : user.companyId ?? '__none__';
}

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  // ── Criar/disparar: operador OU admin do cliente (escopado à empresa dele) ──
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @Post()
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: AuthUser) {
    // Admin do cliente só cria para a PRÓPRIA empresa — nunca escolhe outra.
    if (user.role !== Role.SUPER_ADMIN) {
      dto.companyId = user.companyId ?? '__none__';
    }
    return this.campaigns.create(dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @Post(':id/send')
  @HttpCode(200)
  send(
    @Param('id') id: string,
    @Body() dto: SendCampaignDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.campaigns.send(id, dto, scopeOf(user));
  }

  @Roles(Role.SUPER_ADMIN)
  @Post(':id/share')
  @HttpCode(200)
  share(@Param('id') id: string) {
    return this.campaigns.share(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id/share')
  @HttpCode(200)
  unshare(@Param('id') id: string) {
    return this.campaigns.unshare(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string) {
    return this.campaigns.cancel(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }

  // ── Leituras: operador (tudo) ou admin do cliente (só a própria empresa) ──
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.campaigns.findAll(scopeOf(user));
  }

  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.campaigns.findOne(id, scopeOf(user));
  }

  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @Get(':id/targets')
  targets(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.campaigns.listTargets(id, scopeOf(user));
  }

  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @Get(':id/events')
  events(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.campaigns.listEvents(id, scopeOf(user));
  }

  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @Get(':id/stats')
  stats(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.campaigns.getStats(id, scopeOf(user));
  }
}
