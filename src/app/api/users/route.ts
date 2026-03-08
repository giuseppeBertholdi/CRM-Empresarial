import { z } from "zod";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { ROLES } from "@/lib/constants";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(ROLES),
  departmentId: z.string().nullable().optional(),
  whatsappPhone: z.string().min(8).nullable().optional(),
  whatsappPhoneNumberId: z.string().min(5).nullable().optional(),
  whatsappAccessToken: z.string().min(10).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) {
    return jsonError("Não autenticado.", 401);
  }

  const users = await prisma.user.findMany({
    where:
      user.role === "ADMIN" || !user.departmentId
        ? undefined
        : { departmentId: user.departmentId },
    include: {
      department: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({
    users: users.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.role,
      department: item.department,
      whatsappPhone: item.whatsappPhone,
      createdAt: item.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) {
    return jsonError("Não autenticado.", 401);
  }
  if (!canManageUsers(user.role)) {
    return jsonError("Sem permissão.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Dados inválidos.", 400);
  }

  const email = parsed.data.email.toLowerCase();

  let authUserId = "";
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        name: parsed.data.name,
      },
    });

    if (error || !data.user) {
      return jsonError("Não foi possível criar usuário no Supabase Auth.", 400);
    }
    authUserId = data.user.id;
  } catch {
    return jsonError(
      "Supabase Admin não configurado. Defina SUPABASE_SERVICE_ROLE_KEY.",
      500
    );
  }

  const createdUser = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      authUserId,
      role: parsed.data.role,
      departmentId: parsed.data.departmentId ?? null,
      whatsappPhone: parsed.data.whatsappPhone ?? null,
      whatsappPhoneNumberId: parsed.data.whatsappPhoneNumberId ?? null,
      whatsappAccessToken: parsed.data.whatsappAccessToken ?? null,
    },
  });

  await logAction({
    userId: user.id,
    action: "USER_CREATE",
    entity: "User",
    entityId: createdUser.id,
  });

  return jsonOk({ user: createdUser }, 201);
}
