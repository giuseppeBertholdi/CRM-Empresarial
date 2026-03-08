import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/session";

export async function getApiUser(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.userId },
    include: { department: true },
  });
}
