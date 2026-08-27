import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto, UpdateCompanyUserDto } from './dto/company.dto';

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

  // Lista os usuários (clientes) da empresa — para o admin editar.
  async listUsers(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    return this.prisma.user.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
      },
    });
  }

  // Edita um usuário da empresa: troca o nome e/ou define uma nova senha.
  // Trocar a senha invalida as sessões ativas do usuário.
  async updateUser(companyId: string, userId: string, dto: UpdateCompanyUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.companyId !== companyId) {
      throw new NotFoundException('Usuário não encontrado nesta empresa.');
    }
    const data: { name?: string; passwordHash?: string } = {};
    if (dto.name !== undefined && dto.name.trim()) data.name = dto.name.trim();
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);

    if (!data.name && !data.passwordHash) {
      return this.prisma.user.update({
        where: { id: userId },
        data: {},
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data,
        select: { id: true, name: true, email: true, role: true, isActive: true },
      }),
      // Se a senha mudou, derruba as sessões ativas do usuário.
      ...(data.passwordHash
        ? [
            this.prisma.refreshToken.updateMany({
              where: { userId, revokedAt: null },
              data: { revokedAt: new Date() },
            }),
          ]
        : []),
    ]);
    return updated;
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
