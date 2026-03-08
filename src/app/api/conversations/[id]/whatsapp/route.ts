import { z } from "zod";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canAccessDepartment } from "@/lib/rbac";
import { sendWhatsAppText } from "@/lib/whatsapp";

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
    include: {
      customer: {
        select: {
          id: true,
          phone: true,
        },
      },
    },
  });
  if (!conversation) return jsonError("Atendimento não encontrado.", 404);

  if (
    !canAccessDepartment(user.role, user.departmentId, conversation.departmentId)
  ) {
    return jsonError("Sem permissão.", 403);
  }
  if (user.role === "ATTENDANT" && conversation.assignedToId !== user.id) {
    return jsonError(
      "Você só pode enviar WhatsApp em conversas atribuídas a você.",
      403
    );
  }
  if (!user.whatsappPhone) {
    return jsonError(
      "Configure seu número de WhatsApp no perfil antes de enviar.",
      400
    );
  }

  const whatsappResult = await sendWhatsAppText({
    phone: conversation.customer.phone,
    text: parsed.data.content,
    allowEnvFallback: true,
  });

  if (whatsappResult.sent) {
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: user.id,
          senderType: "USER",
          content: parsed.data.content,
          providerMessageId: whatsappResult.providerMessageId,
          deliveryStatus:
            whatsappResult.providerStatus?.toUpperCase() ??
            (whatsappResult.usedTemplateFallback ? "TEMPLATE_ACCEPTED" : "ACCEPTED"),
          deliveryUpdatedAt: new Date(),
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
      action: "WHATSAPP_MESSAGE_SEND",
      entity: "Message",
      entityId: message.id,
      metadata: {
        conversationId: conversation.id,
        providerMessageId: whatsappResult.providerMessageId,
        destinationPhone: conversation.customer.phone,
        usedTemplateFallback: whatsappResult.usedTemplateFallback,
      },
    });

    return jsonOk({
      sentViaCloudApi: true,
      providerMessageId: whatsappResult.providerMessageId,
      usedTemplateFallback: whatsappResult.usedTemplateFallback,
      message: whatsappResult.usedTemplateFallback
        ? "Janela de 24h estava fechada. Enviamos template de fallback e registramos no CRM."
        : "Mensagem aceita pela API do WhatsApp e registrada no CRM. Entrega final depende do status do provedor.",
    });
  }

  return jsonError(
    whatsappResult.reason ?? "Falha ao enviar mensagem pelo WhatsApp.",
    502
  );
}




