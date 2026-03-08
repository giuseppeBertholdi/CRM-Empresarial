import { ConversationStatus, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [, vendas] = await Promise.all([
    prisma.department.upsert({
      where: { name: "RH" },
      update: {},
      create: { name: "RH" },
    }),
    prisma.department.upsert({
      where: { name: "Vendas" },
      update: {},
      create: { name: "Vendas" },
    }),
    prisma.department.upsert({
      where: { name: "Consultoria" },
      update: {},
      create: { name: "Consultoria" },
    }),
  ]);

  const [admin] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@jjsul.com" },
      update: {},
      create: {
        name: "Administrador",
        email: "admin@jjsul.com",
        role: Role.ADMIN,
      },
    }),
    prisma.user.upsert({
      where: { email: "gerente.vendas@jjsul.com" },
      update: {},
      create: {
        name: "Gerente de Vendas",
        email: "gerente.vendas@jjsul.com",
        role: Role.MANAGER,
        departmentId: vendas.id,
      },
    }),
    prisma.user.upsert({
      where: { email: "atendente.vendas@jjsul.com" },
      update: {},
      create: {
        name: "Atendente de Vendas",
        email: "atendente.vendas@jjsul.com",
        role: Role.ATTENDANT,
        departmentId: vendas.id,
      },
    }),
  ]);

  // Seed now creates only base structure (departments/users/rules), without demo
  // customers or conversations, to keep production-like data clean.

  const rulesCount = await prisma.automationRule.count();
  if (rulesCount === 0) {
    await prisma.automationRule.create({
      data: {
        triggerStatus: ConversationStatus.QUOTE_SENT,
        delayHours: 24,
        messageTemplate:
          "Follow-up automatico: {{cliente}}, confirmamos se recebeu a cotacao de transporte da {{empresa}}. Atendimento {{atendimentoId}}.",
        isActive: true,
        departmentId: vendas.id,
        createdById: admin.id,
      },
    });
  }

  console.log("Seed concluido com sucesso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
