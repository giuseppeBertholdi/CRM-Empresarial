import { z } from "zod";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { ROLES } from "@/lib/constants";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(ROLES).optional(),
  departmentId: z.string().nullable().optional(),
  password: z.string().min(6).optional(),
  whatsappPhone: z.string().min(8).nullable().optional(),
  whatsappPhoneNumberId: z.string().min(5).nullable().optional(),
  whatsappAccessToken: z.string().min(10).nullable().optional(),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);
  if (!canManageUsers(user.role)) return jsonError("Sem permissão.", 403);

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Dados inválidos.", 400);
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
  });
  if (!existingUser) {
    return jsonError("Usuário não encontrado.", 404);
  }

  const data: {
    name?: string;
    role?: (typeof ROLES)[number];
    departmentId?: string | null;
    whatsappPhone?: string | null;
    whatsappPhoneNumberId?: string | null;
    whatsappAccessToken?: string | null;
  } = {};

  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.role) data.role = parsed.data.role;
  if (Object.hasOwn(parsed.data, "departmentId")) {
    data.departmentId = parsed.data.departmentId ?? null;
  }
  if (Object.hasOwn(parsed.data, "whatsappPhone")) {
    data.whatsappPhone = parsed.data.whatsappPhone ?? null;
  }
  if (Object.hasOwn(parsed.data, "whatsappPhoneNumberId")) {
    data.whatsappPhoneNumberId = parsed.data.whatsappPhoneNumberId ?? null;
  }
  if (Object.hasOwn(parsed.data, "whatsappAccessToken")) {
    data.whatsappAccessToken = parsed.data.whatsappAccessToken ?? null;
  }
  if (parsed.data.password) {
    if (!existingUser.authUserId) {
      return jsonError(
        "Usuário ainda não vinculado ao Supabase Auth. Faça login uma vez ou recrie o usuário.",
        400
      );
    }
    try {
      const supabaseAdmin = getSupabaseAdminClient();
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.authUserId,
        {
          password: parsed.data.password,
        }
      );
      if (error) {
        return jsonError("Não foi possível atualizar senha no Supabase.", 400);
      }
    } catch {
      return jsonError(
        "Supabase Admin não configurado. Defina SUPABASE_SERVICE_ROLE_KEY.",
        500
      );
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data,
  });

  await logAction({
    userId: user.id,
    action: "USER_UPDATE",
    entity: "User",
    entityId: updatedUser.id,
  });

  return jsonOk({ user: updatedUser });
}
