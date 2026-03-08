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

const createSchema = z.object({
  customerId: z.string().min(1),
  departmentId: z.string().optional(),
  assignedToId: z.string().optional().nullable(),
  status: z.enum(CONVERSATION_STATUSES).optional(),
  initialMessage: z.string().min(1).optional(),
});

function statusFromQuery(value: string | null): ConversationStatus | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase();
  if (CONVERSATION_STATUSES.includes(upper as ConversationStatus)) {
    return upper as ConversationStatus;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const search = request.nextUrl.searchParams.get("q");
  const status = statusFromQuery(request.nextUrl.searchParams.get("status"));
  const departmentIdParam = request.nextUrl.searchParams.get("departmentId");

  const whereDepartmentId =
    user.role === "ADMIN"
      ? departmentIdParam ?? undefined
      : user.departmentId ?? "__without_department__";
  const whereAssignedToId = user.role === "ATTENDANT" ? user.id : undefined;

  const conversations = await prisma.conversation.findMany({
    where: {
      departmentId: whereDepartmentId,
      assignedToId: whereAssignedToId,
      status,
      customer: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { company: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
    },
    include: {
      customer: true,
      department: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: {
        select: { messages: true },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  return jsonOk({ conversations });
}

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos.", 400);

  const resolvedDepartmentId = parsed.data.departmentId ?? user.departmentId;
  if (!resolvedDepartmentId) {
    return jsonError("Departamento é obrigatório.", 400);
  }

  if (!canAccessDepartment(user.role, user.departmentId, resolvedDepartmentId)) {
    return jsonError("Sem permissão para esse setor.", 403);
  }

  const status = parsed.data.status ?? "OPEN";
  const assignedToId =
    user.role === "ATTENDANT"
      ? user.id
      : (parsed.data.assignedToId ?? null);

  const conversation = await prisma.conversation.create({
    data: {
      customerId: parsed.data.customerId,
      departmentId: resolvedDepartmentId,
      assignedToId,
      status,
      lastMessageAt: new Date(),
      messages: parsed.data.initialMessage
        ? {
            create: {
              senderId: user.id,
              senderType: "USER",
              content: parsed.data.initialMessage,
            },
          }
        : undefined,
    },
    include: {
      customer: true,
      department: true,
      assignedTo: true,
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (conversation.status === "QUOTE_SENT") {
    await scheduleRemindersForConversation(conversation.id, conversation.status);
  }

  await logAction({
    userId: user.id,
    action: "CONVERSATION_CREATE",
    entity: "Conversation",
    entityId: conversation.id,
    metadata: {
      status: conversation.status,
      departmentId: conversation.departmentId,
    },
  });

  return jsonOk({ conversation }, 201);
}
