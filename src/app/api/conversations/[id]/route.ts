import { z } from "zod";
import { ConversationStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { CONVERSATION_STATUSES } from "@/lib/constants";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canAccessDepartment } from "@/lib/rbac";
import { scheduleRemindersForConversation } from "@/lib/reminders";

const updateSchema = z.object({
  status: z.enum(CONVERSATION_STATUSES).optional(),
  assignedToId: z.string().nullable().optional(),
  departmentId: z.string().optional(),
});

type Params = {
  params: Promise<{ id: string }>;
};

async function getConversationOrFail(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      customer: true,
      department: true,
      assignedTo: {
        select: { id: true, name: true, email: true, role: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: {
            select: { id: true, name: true, role: true },
          },
        },
      },
      reminderLogs: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const { id } = await params;
  const conversation = await getConversationOrFail(id);
  if (!conversation) return jsonError("Atendimento não encontrado.", 404);

  if (
    !canAccessDepartment(user.role, user.departmentId, conversation.departmentId)
  ) {
    return jsonError("Sem permissão.", 403);
  }
  if (user.role === "ATTENDANT" && conversation.assignedToId !== user.id) {
    return jsonError("Sem permissão para este atendimento.", 403);
  }

  return jsonOk({ conversation });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const { id } = await params;
  const existing = await prisma.conversation.findUnique({ where: { id } });
  if (!existing) return jsonError("Atendimento não encontrado.", 404);

  if (!canAccessDepartment(user.role, user.departmentId, existing.departmentId)) {
    return jsonError("Sem permissão.", 403);
  }
  if (user.role === "ATTENDANT" && existing.assignedToId !== user.id) {
    return jsonError("Sem permissão para este atendimento.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos.", 400);

  const targetDepartmentId = parsed.data.departmentId ?? existing.departmentId;
  if (!canAccessDepartment(user.role, user.departmentId, targetDepartmentId)) {
    return jsonError("Sem permissão para o setor informado.", 403);
  }

  const conversation = await prisma.conversation.update({
    where: { id },
    data: {
      status: parsed.data.status as ConversationStatus | undefined,
      assignedToId: Object.hasOwn(parsed.data, "assignedToId")
        ? parsed.data.assignedToId
        : undefined,
      departmentId: parsed.data.departmentId,
    },
    include: {
      customer: true,
      department: true,
      assignedTo: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  if (parsed.data.status && parsed.data.status !== existing.status) {
    await scheduleRemindersForConversation(conversation.id, parsed.data.status);
  }

  await logAction({
    userId: user.id,
    action: "CONVERSATION_UPDATE",
    entity: "Conversation",
    entityId: conversation.id,
    metadata: {
      fromStatus: existing.status,
      toStatus: conversation.status,
    },
  });

  return jsonOk({ conversation });
}
