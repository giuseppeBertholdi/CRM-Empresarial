import { z } from "zod";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  email: z.string().email().optional().nullable(),
  company: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
  });

  if (!customer) return jsonError("Cliente não encontrado.", 404);
  return jsonOk({ customer });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos.", 400);

  const customer = await prisma.customer.update({
    where: { id },
    data: parsed.data,
  });

  await logAction({
    userId: user.id,
    action: "CUSTOMER_UPDATE",
    entity: "Customer",
    entityId: customer.id,
  });

  return jsonOk({ customer });
}
