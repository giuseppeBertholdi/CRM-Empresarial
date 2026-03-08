import { z } from "zod";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  whatsappPhone: z.string().min(8).nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos.", 400);

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      whatsappPhone: Object.hasOwn(parsed.data, "whatsappPhone")
        ? (parsed.data.whatsappPhone ?? null)
        : undefined,
    },
    select: {
      id: true,
      whatsappPhone: true,
    },
  });

  return jsonOk({
    user: {
      ...updatedUser,
    },
  });
}

