import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { AutomationsManager } from "@/components/automations/automations-manager";
import { isQueueEnabled } from "@/lib/queue";

export default async function AutomationsPage() {
  const user = await requireCurrentUser();

  if (user.role === "ATTENDANT") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Automações</h1>
        <p className="mt-2 text-sm text-slate-500">
          Somente gerentes e administradores podem gerenciar regras automáticas.
        </p>
      </div>
    );
  }

  const [automations, departments, logsSummary] = await Promise.all([
    prisma.automationRule.findMany({
      where:
        user.role === "ADMIN" || !user.departmentId
          ? undefined
          : {
              OR: [{ departmentId: null }, { departmentId: user.departmentId }],
            },
      include: {
        department: true,
        _count: {
          select: { reminderLogs: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.department.findMany({
      where:
        user.role === "ADMIN" || !user.departmentId
          ? undefined
          : { id: user.departmentId },
      orderBy: { name: "asc" },
    }),
    prisma.reminderLog.groupBy({
      by: ["status"],
      where:
        user.role === "ADMIN" || !user.departmentId
          ? undefined
          : {
              conversation: {
                departmentId: user.departmentId,
              },
            },
      _count: { _all: true },
    }),
  ]);

  const sentLogsCount =
    logsSummary.find((item) => item.status === "SENT")?._count._all ?? 0;
  const failedLogsCount =
    logsSummary.find((item) => item.status === "FAILED")?._count._all ?? 0;

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-indigo-50 p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Automações</h1>
        <p className="mt-1 text-sm text-slate-600">
          Motor inteligente de follow-up por status com controle de fila e
          processamento seguro.
        </p>
      </header>

      <AutomationsManager
        initialRules={JSON.parse(JSON.stringify(automations))}
        departments={JSON.parse(JSON.stringify(departments))}
        currentUserRole={user.role}
        currentUserDepartmentId={user.departmentId}
        queueEnabled={isQueueEnabled()}
        sentLogsCount={sentLogsCount}
        failedLogsCount={failedLogsCount}
      />
    </div>
  );
}
