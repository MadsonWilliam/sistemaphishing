import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, SendCampaignDto } from './dto/campaign.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Roles(Role.SUPER_ADMIN)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Get()
  findAll() {
    return this.campaigns.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.campaigns.findOne(id);
  }

  @Get(':id/targets')
  targets(@Param('id') id: string) {
    return this.campaigns.listTargets(id);
  }

  @Get(':id/stats')
  stats(@Param('id') id: string) {
    return this.campaigns.getStats(id);
  }

  @Post(':id/send')
  @HttpCode(200)
  send(@Param('id') id: string, @Body() dto: SendCampaignDto) {
    return this.campaigns.send(id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string) {
    return this.campaigns.cancel(id);
  }
}
