import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookies } from "@/lib/session";

export async function getCurrentUser() {
  const session = await getSessionFromCookies();
  if (!session) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.userId },
    include: { department: true },
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
