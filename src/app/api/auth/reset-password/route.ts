import { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return jsonError("Payload inválido.", 400);
  }

  return jsonOk({
    message:
      "Fluxo de redefinição é gerenciado pelo Supabase via link enviado por email.",
  });
}
