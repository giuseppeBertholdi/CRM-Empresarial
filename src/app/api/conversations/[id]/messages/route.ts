import { z } from "zod";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canAccessDepartment } from "@/lib/rbac";

const schema = z.object({
  content: z.string().min(1),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Mensagem inválida.", 400);

  const conversation = await prisma.conversation.findUnique({
    where: { id },
  });
  if (!conversation) return jsonError("Atendimento não encontrado.", 404);

  if (
    !canAccessDepartment(user.role, user.departmentId, conversation.departmentId)
  ) {
    return jsonError("Sem permissão.", 403);
  }
  if (user.role === "ATTENDANT" && conversation.assignedToId !== user.id) {
    return jsonError("Sem permissão para este atendimento.", 403);
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: user.id,
        senderType: "USER",
        content: parsed.data.content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
    }),
  ]);

  await logAction({
    userId: user.id,
    action: "MESSAGE_CREATE",
    entity: "Message",
    entityId: message.id,
    metadata: {
      conversationId: conversation.id,
    },
  });

  return jsonOk({ message }, 201);
}
