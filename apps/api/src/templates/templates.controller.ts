import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/template.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  // Criar/excluir modelos é da plataforma.
  @Roles(Role.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templates.create(dto);
  }

  // A biblioteca de iscas é visível ao admin do cliente (para montar campanha).
  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @Get()
  findAll() {
    return this.templates.findAll();
  }

  @Roles(Role.SUPER_ADMIN, Role.COMPANY_ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.templates.findOne(id);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.templates.remove(id);
  }
}
