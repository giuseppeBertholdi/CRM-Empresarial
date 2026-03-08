import { z } from "zod";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canManageDepartments } from "@/lib/rbac";

const createDepartmentSchema = z.object({
  name: z.string().min(2),
});

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) {
    return jsonError("Não autenticado.", 401);
  }

  const departments = await prisma.department.findMany({
    where:
      user.role === "ADMIN" || !user.departmentId
        ? undefined
        : { id: user.departmentId },
    orderBy: { name: "asc" },
  });

  return jsonOk({ departments });
}

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) {
    return jsonError("Não autenticado.", 401);
  }
  if (!canManageDepartments(user.role)) {
    return jsonError("Sem permissão.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = createDepartmentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Dados inválidos.", 400);
  }

  const department = await prisma.department.create({
    data: {
      name: parsed.data.name,
    },
  });

  await logAction({
    userId: user.id,
    action: "DEPARTMENT_CREATE",
    entity: "Department",
    entityId: department.id,
  });

  return jsonOk({ department }, 201);
}
