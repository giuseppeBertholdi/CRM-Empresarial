import { z } from "zod";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { CONVERSATION_STATUSES } from "@/lib/constants";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canManageAutomations } from "@/lib/rbac";

const createSchema = z.object({
  triggerStatus: z.enum(CONVERSATION_STATUSES),
  delayHours: z.number().int().min(1),
  messageTemplate: z.string().min(3),
  isActive: z.boolean().optional(),
  departmentId: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const automations = await prisma.automationRule.findMany({
    where:
      user.role === "ADMIN" || !user.departmentId
        ? undefined
        : {
            OR: [{ departmentId: null }, { departmentId: user.departmentId }],
          },
    include: {
      department: true,
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { reminderLogs: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({ automations });
}

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);
  if (!canManageAutomations(user.role)) return jsonError("Sem permissão.", 403);

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos.", 400);

  const departmentId =
    user.role === "ADMIN"
      ? parsed.data.departmentId ?? null
      : user.departmentId ?? null;

  const rule = await prisma.automationRule.create({
    data: {
      triggerStatus: parsed.data.triggerStatus,
      delayHours: parsed.data.delayHours,
      messageTemplate: parsed.data.messageTemplate,
      isActive: parsed.data.isActive ?? true,
      departmentId,
      createdById: user.id,
    },
  });

  await logAction({
    userId: user.id,
    action: "AUTOMATION_CREATE",
    entity: "AutomationRule",
    entityId: rule.id,
  });

  return jsonOk({ rule }, 201);
}
