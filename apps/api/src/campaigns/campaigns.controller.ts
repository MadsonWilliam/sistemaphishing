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

  @Get(':id/events')
  events(@Param('id') id: string) {
    return this.campaigns.listEvents(id);
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

  @Post(':id/share')
  @HttpCode(200)
  share(@Param('id') id: string) {
    return this.campaigns.share(id);
  }

  @Delete(':id/share')
  @HttpCode(200)
  unshare(@Param('id') id: string) {
    return this.campaigns.unshare(id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string) {
    return this.campaigns.cancel(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }
}
