import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyUserDto } from './dto/company.dto';
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

  // Usuários (clientes) da empresa — para editar nome/senha.
  @Roles(Role.SUPER_ADMIN)
  @Get(':id/users')
  listUsers(@Param('id') id: string) {
    return this.companies.listUsers(id);
  }

  // Edita um usuário da empresa: nome e/ou nova senha.
  @Roles(Role.SUPER_ADMIN)
  @Patch(':id/users/:userId')
  updateUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateCompanyUserDto,
  ) {
    return this.companies.updateUser(id, userId, dto);
  }

  // Liga/desliga recorrência de campanha para o admin do cliente.
  @Roles(Role.SUPER_ADMIN)
  @Patch(':id/recurrence')
  setRecurrence(
    @Param('id') id: string,
    @Body() body: { allowRecurrence: boolean },
  ) {
    return this.companies.setRecurrence(id, !!body.allowRecurrence);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companies.remove(id);
  }
}
