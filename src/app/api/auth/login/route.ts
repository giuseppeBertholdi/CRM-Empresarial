import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieConfig, signSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import { logAction } from "@/lib/activity-log";
import { getSupabaseAnonClient } from "@/lib/supabase";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Dados de login inválidos.", 400);
  }

  const email = parsed.data.email.toLowerCase();

  let authUserId = "";
  let authUserName = "";
  try {
    const supabase = getSupabaseAnonClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      return jsonError("Email ou senha inválidos.", 401);
    }

    authUserId = data.user.id;
    authUserName =
      typeof data.user.user_metadata?.name === "string"
        ? data.user.user_metadata.name
        : "";
  } catch {
    return jsonError(
      "Supabase Auth não configurado. Verifique variáveis de ambiente.",
      500
    );
  }

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: authUserName || email.split("@")[0],
        email,
        authUserId,
      },
    });
  } else if (!user.authUserId || user.authUserId !== authUserId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        authUserId,
      },
    });
  }

  if (!user) {
    return jsonError("Email ou senha inválidos.", 401);
  }

  const token = signSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    name: user.name,
  });

  const { name, options } = getSessionCookieConfig();
  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
    },
  });
  response.cookies.set(name, token, options);

  await logAction({
    userId: user.id,
    action: "AUTH_LOGIN",
    entity: "AUTH",
    metadata: {
      email: user.email,
    },
  });

  return response;
}
