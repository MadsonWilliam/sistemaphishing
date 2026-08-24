import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { LeadsService } from './leads.service';
import { CreateLeadDto, UpdateLeadDto } from './dto/lead.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  // Formulário público da landing. Anti-spam: no máx. 5 envios/min por IP.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }

  // Só o operador vê os leads recebidos.
  @Roles(Role.SUPER_ADMIN)
  @Get()
  list() {
    return this.leads.list();
  }

  // Mini-CRM: avançar estágio / anotar (só o operador).
  @Roles(Role.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(id, dto);
  }

  // Envia o termo de autorização ao cliente (aceite por resposta ao e-mail).
  @Roles(Role.SUPER_ADMIN)
  @Post(':id/send-term')
  @HttpCode(200)
  sendTerm(@Param('id') id: string) {
    return this.leads.sendTerm(id);
  }
}
