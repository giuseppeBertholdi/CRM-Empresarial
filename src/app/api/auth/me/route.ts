import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) {
    return jsonError("Não autenticado.", 401);
  }

  return jsonOk({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      whatsappPhone: user.whatsappPhone,
      whatsappPhoneNumberId: user.whatsappPhoneNumberId,
      hasWhatsappAccessToken: Boolean(user.whatsappAccessToken),
    },
  });
}
