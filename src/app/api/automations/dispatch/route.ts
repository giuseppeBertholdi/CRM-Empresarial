import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { jsonError, jsonOk } from "@/lib/http";
import { canManageAutomations } from "@/lib/rbac";
import { dispatchDueReminders } from "@/lib/reminders";

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);
  if (!canManageAutomations(user.role)) return jsonError("Sem permissão.", 403);

  const result = await dispatchDueReminders(200);
  return jsonOk({ result });
}
