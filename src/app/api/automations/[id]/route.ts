import { z } from "zod";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { CONVERSATION_STATUSES } from "@/lib/constants";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canManageAutomations } from "@/lib/rbac";

const updateSchema = z.object({
  triggerStatus: z.enum(CONVERSATION_STATUSES).optional(),
  delayHours: z.number().int().min(1).optional(),
  messageTemplate: z.string().min(3).optional(),
  isActive: z.boolean().optional(),
  departmentId: z.string().nullable().optional(),
});

type Params = {
  params: Promise<{ id: string }>;
};

function canManageRule(
  role: string,
  userDepartmentId: string | null,
  ruleDepartmentId: string | null
) {
  if (role === "ADMIN") return true;
  return userDepartmentId && userDepartmentId === ruleDepartmentId;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);
  if (!canManageAutomations(user.role)) return jsonError("Sem permissão.", 403);

  const { id } = await params;
  const existing = await prisma.automationRule.findUnique({
    where: { id },
  });
  if (!existing) return jsonError("Regra não encontrada.", 404);

  if (!canManageRule(user.role, user.departmentId, existing.departmentId)) {
    return jsonError("Sem permissão para esta regra.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos.", 400);

  const rule = await prisma.automationRule.update({
    where: { id },
    data: {
      ...parsed.data,
      departmentId:
        user.role === "ADMIN"
          ? parsed.data.departmentId
          : existing.departmentId ?? user.departmentId,
    },
  });

  await logAction({
    userId: user.id,
    action: "AUTOMATION_UPDATE",
    entity: "AutomationRule",
    entityId: rule.id,
  });

  return jsonOk({ rule });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);
  if (!canManageAutomations(user.role)) return jsonError("Sem permissão.", 403);

  const { id } = await params;
  const existing = await prisma.automationRule.findUnique({
    where: { id },
  });
  if (!existing) return jsonError("Regra não encontrada.", 404);

  if (!canManageRule(user.role, user.departmentId, existing.departmentId)) {
    return jsonError("Sem permissão para esta regra.", 403);
  }

  await prisma.automationRule.delete({
    where: { id },
  });

  await logAction({
    userId: user.id,
    action: "AUTOMATION_DELETE",
    entity: "AutomationRule",
    entityId: id,
  });

  return jsonOk({ ok: true });
}
