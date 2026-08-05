import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { DomainsService } from './domains.service';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateSendingDomainDto,
  CreateSenderIdentityDto,
  SendTestEmailDto,
} from './dto/domain.dto';

// Gestão dos domínios de envio é da plataforma (SUPER_ADMIN) neste estágio.
@Roles(Role.SUPER_ADMIN)
@Controller('sending-domains')
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Post()
  create(@Body() dto: CreateSendingDomainDto) {
    return this.domains.create(dto);
  }

  @Get()
  findAll() {
    return this.domains.findAll();
  }

  @Post(':id/verify')
  @HttpCode(200)
  verify(@Param('id') id: string) {
    return this.domains.verify(id);
  }

  @Post(':id/identities')
  addIdentity(
    @Param('id') id: string,
    @Body() dto: CreateSenderIdentityDto,
  ) {
    return this.domains.addIdentity(id, dto);
  }

  @Get(':id/identities')
  listIdentities(@Param('id') id: string) {
    return this.domains.listIdentities(id);
  }

  @Post(':id/test')
  @HttpCode(200)
  sendTest(@Param('id') id: string, @Body() dto: SendTestEmailDto) {
    return this.domains.sendTest(id, dto);
  }
}
