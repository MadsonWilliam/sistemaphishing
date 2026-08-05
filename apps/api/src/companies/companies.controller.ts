import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/company.dto';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  // Somente a plataforma (nós) cria empresas.
  @Roles(Role.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companies.create(dto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Get()
  findAll() {
    return this.companies.findAll();
  }

  // SUPER_ADMIN vê qualquer empresa; COMPANY_ADMIN/ANALYST só a própria.
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    if (user.role !== Role.SUPER_ADMIN && user.companyId !== id) {
      throw new ForbiddenException('Acesso restrito à sua própria empresa.');
    }
    return this.companies.findOne(id);
  }
}
