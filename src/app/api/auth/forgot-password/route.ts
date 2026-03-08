import { z } from "zod";
import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { logAction } from "@/lib/activity-log";
import { getSupabaseAnonClient } from "@/lib/supabase";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Email inválido.", 400);
  }

  const email = parsed.data.email.toLowerCase();
  try {
    const supabase = getSupabaseAnonClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.APP_URL}/reset-password`,
    });

    if (error) {
      return jsonError("Não foi possível iniciar a recuperação de senha.", 400);
    }
  } catch {
    return jsonError(
      "Supabase Auth não configurado. Verifique variáveis de ambiente.",
      500
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    await logAction({
      userId: user.id,
      action: "AUTH_FORGOT_PASSWORD",
      entity: "AUTH",
    });
  }

  return jsonOk({
    message:
      "Se o email existir na base, você receberá instruções para redefinir a senha.",
  });
}
