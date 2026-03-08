import { z } from "zod";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canManageDepartments } from "@/lib/rbac";

const updateSchema = z.object({
  name: z.string().min(2),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);
  if (!canManageDepartments(user.role)) return jsonError("Sem permissão.", 403);

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Dados inválidos.", 400);

  const department = await prisma.department.update({
    where: { id },
    data: { name: parsed.data.name },
  });

  await logAction({
    userId: user.id,
    action: "DEPARTMENT_UPDATE",
    entity: "Department",
    entityId: department.id,
  });

  return jsonOk({ department });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);
  if (!canManageDepartments(user.role)) return jsonError("Sem permissão.", 403);

  const { id } = await params;
  await prisma.department.delete({ where: { id } });

  await logAction({
    userId: user.id,
    action: "DEPARTMENT_DELETE",
    entity: "Department",
    entityId: id,
  });

  return jsonOk({ ok: true });
}
