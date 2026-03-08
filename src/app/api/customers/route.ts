import { z } from "zod";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional().nullable(),
  company: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const search = request.nextUrl.searchParams.get("q");

  const customers = await prisma.customer.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      _count: {
        select: { conversations: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({ customers });
}

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos.", 400);

  const customer = await prisma.customer.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email ?? null,
      company: parsed.data.company ?? null,
      notes: parsed.data.notes ?? null,
    },
  });

  await logAction({
    userId: user.id,
    action: "CUSTOMER_CREATE",
    entity: "Customer",
    entityId: customer.id,
  });

  return jsonOk({ customer }, 201);
}
