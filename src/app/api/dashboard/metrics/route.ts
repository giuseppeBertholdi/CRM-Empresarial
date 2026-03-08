import { subDays } from "date-fns";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const scopeFilter =
    user.role === "ADMIN" || !user.departmentId
      ? {}
      : { departmentId: user.departmentId };

  const [openAttendances, groupedByDepartment, conversations, activeCustomers] =
    await Promise.all([
      prisma.conversation.count({
        where: {
          ...scopeFilter,
          status: {
            in: ["OPEN", "WAITING", "QUOTE_SENT"],
          },
        },
      }),
      prisma.conversation.groupBy({
        by: ["departmentId"],
        where: scopeFilter,
        _count: { _all: true },
      }),
      prisma.conversation.findMany({
        where: scopeFilter,
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
        take: 200,
      }),
      prisma.customer.count({
        where: {
          conversations: {
            some: {
              ...scopeFilter,
              lastMessageAt: {
                gte: subDays(new Date(), 30),
              },
            },
          },
        },
      }),
    ]);

  const departments = await prisma.department.findMany({
    where:
      user.role === "ADMIN" || !user.departmentId
        ? undefined
        : { id: user.departmentId },
  });

  const departmentMap = new Map(departments.map((dep) => [dep.id, dep.name]));
  const attendancesByDepartment = groupedByDepartment.map((item) => ({
    departmentId: item.departmentId,
    departmentName: departmentMap.get(item.departmentId) ?? "Desconhecido",
    total: item._count._all,
  }));

  const responseTimesInMinutes = conversations
    .map((conversation) => {
      const firstMessage = conversation.messages[0];
      if (!firstMessage) return null;
      return (
        (firstMessage.createdAt.getTime() - conversation.createdAt.getTime()) /
        1000 /
        60
      );
    })
    .filter((value): value is number => value !== null && value >= 0);

  const averageResponseTimeMinutes = responseTimesInMinutes.length
    ? Number(
        (
          responseTimesInMinutes.reduce((acc, value) => acc + value, 0) /
          responseTimesInMinutes.length
        ).toFixed(2)
      )
    : 0;

  return jsonOk({
    metrics: {
      openAttendances,
      attendancesByDepartment,
      averageResponseTimeMinutes,
      activeCustomers,
    },
  });
}
