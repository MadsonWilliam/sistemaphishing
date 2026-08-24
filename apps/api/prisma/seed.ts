import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { TEMPLATE_LIBRARY } from './templates-library';

const prisma = new PrismaClient();

// Carrega a biblioteca de iscas da plataforma (idempotente por nome).
async function seedTemplates() {
  let created = 0;
  let updated = 0;
  for (const t of TEMPLATE_LIBRARY) {
    const exists = await prisma.template.findFirst({
      where: { name: t.name, companyId: null },
      select: { id: true },
    });
    const data = {
      sector: t.sector,
      trigger: t.trigger,
      difficulty: t.difficulty,
      subject: t.subject,
      html: t.html,
    };
    if (exists) {
      // Mantém as iscas da biblioteca sincronizadas com o código (assunto/html).
      await prisma.template.update({ where: { id: exists.id }, data });
      updated++;
    } else {
      await prisma.template.create({
        data: { name: t.name, companyId: null, ...data },
      });
      created++;
    }
  }
  console.log(
    `[seed] Biblioteca de iscas: ${created} novo(s), ${updated} atualizado(s), ${TEMPLATE_LIBRARY.length} no total.`,
  );
}

async function seedSuperAdmin() {
  const email = process.env.SUPER_ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME ?? 'Administrador';

  if (!email || !password) {
    console.log(
      '[seed] SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD não definidos — pulando super admin.',
    );
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] Super admin já existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, name, passwordHash, role: Role.SUPER_ADMIN },
  });
  console.log(`[seed] Super admin criado: ${email}`);
}

async function main() {
  // Seeding nunca pode derrubar o boot da aplicação — erros são logados, não propagados.
  try {
    await seedSuperAdmin();
  } catch (e) {
    console.error('[seed] super admin falhou (seguindo):', e);
  }
  try {
    await seedTemplates();
  } catch (e) {
    console.error('[seed] biblioteca de iscas falhou (seguindo):', e);
  }
}

main()
  .catch((e) => {
    console.error('[seed] Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
