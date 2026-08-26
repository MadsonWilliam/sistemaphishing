import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  // Cria a empresa (tenant) e seu primeiro COMPANY_ADMIN numa transação.
  async create(dto: CreateCompanyDto) {
    const email = dto.adminEmail.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

    return this.prisma.company.create({
      data: {
        name: dto.name,
        legalName: dto.legalName,
        cnpj: dto.cnpj,
        allowRecurrence: dto.allowRecurrence ?? false,
        users: {
          create: {
            email,
            name: dto.adminName,
            passwordHash,
            role: Role.COMPANY_ADMIN,
          },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });
  }

  findAll() {
    return this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        legalName: true,
        cnpj: true,
        status: true,
        allowRecurrence: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
    });
  }

  // Liga/desliga a recorrência de campanha para o admin do cliente.
  async setRecurrence(id: string, allow: boolean) {
    const exists = await this.prisma.company.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Empresa não encontrada.');
    return this.prisma.company.update({
      where: { id },
      data: { allowRecurrence: allow },
      select: { id: true, name: true, allowRecurrence: true },
    });
  }

  // Remove a empresa e tudo dela (usuários, campanhas→alvos→eventos,
  // autorizações). Domínios/templates ficam com companyId nulo (SetNull).
  async remove(id: string) {
    const exists = await this.prisma.company.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Empresa não encontrada.');
    await this.prisma.$transaction([
      this.prisma.emailOutbox.deleteMany({ where: { companyId: id } }),
      this.prisma.company.delete({ where: { id } }),
    ]);
    return { deleted: true };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        legalName: true,
        cnpj: true,
        status: true,
        allowRecurrence: true,
        createdAt: true,
        authorizations: {
          where: { revokedAt: null },
          orderBy: { acceptedAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }
    return company;
  }
}
