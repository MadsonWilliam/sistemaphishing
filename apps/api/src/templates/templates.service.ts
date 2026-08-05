import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/template.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTemplateDto) {
    return this.prisma.template.create({
      data: {
        name: dto.name,
        sector: dto.sector,
        trigger: dto.trigger,
        difficulty: dto.difficulty,
        subject: dto.subject,
        html: dto.html,
        landingHtml: dto.landingHtml ?? null,
        companyId: dto.companyId ?? null,
      },
    });
  }

  findAll() {
    return this.prisma.template.findMany({
      orderBy: [{ sector: 'asc' }, { difficulty: 'asc' }],
    });
  }

  async findOne(id: string) {
    const t = await this.prisma.template.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Template não encontrado.');
    return t;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.template.delete({ where: { id } });
    return { deleted: true };
  }
}
