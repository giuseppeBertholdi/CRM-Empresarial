import { endOfDay, eachDayOfInterval, format, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

type Status = "OPEN" | "WAITING" | "QUOTE_SENT" | "CLOSED";
const STATUS_COLORS: Record<Status, string> = {
  OPEN: "#10b981",
  WAITING: "#f59e0b",
  QUOTE_SENT: "#3b82f6",
  CLOSED: "#64748b",
};
const STATUS_LABELS: Record<Status, string> = {
  OPEN: "Aberto",
  WAITING: "Aguardando",
  QUOTE_SENT: "Cotação enviada",
  CLOSED: "Encerrado",
};

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const scopeFilter =
    user.role === "ADMIN" || !user.departmentId
      ? {}
      : { departmentId: user.departmentId };

  const last30Days = subDays(new Date(), 30);
  const last7Days = subDays(new Date(), 6);

  const [
    openAttendances,
    groupedByDepartment,
    conversations,
    activeCustomers,
    closedLast7Days,
  ] =
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
                gte: last30Days,
              },
            },
          },
        },
      }),
      prisma.conversation.count({
        where: {
          ...scopeFilter,
          status: "CLOSED",
          updatedAt: { gte: last7Days },
        },
      }),
    ]);

  const departments = await prisma.department.findMany({
    where:
      user.role === "ADMIN" || !user.departmentId
        ? undefined
        : { id: user.departmentId },
  });
  const departmentMap = new Map(departments.map((item) => [item.id, item.name]));

  const avgResponseMinutes = conversations.length
    ? Number(
        (
          conversations.reduce((acc, conversation) => {
            const firstMessage = conversation.messages[0];
            if (!firstMessage) return acc;
            const minutes =
              (firstMessage.createdAt.getTime() - conversation.createdAt.getTime()) /
              1000 /
              60;
            return acc + Math.max(0, minutes);
          }, 0) / conversations.length
        ).toFixed(2)
      )
    : 0;

  const statusCounters: Record<Status, number> = {
    OPEN: 0,
    WAITING: 0,
    QUOTE_SENT: 0,
    CLOSED: 0,
  };
  for (const conversation of conversations) {
    statusCounters[conversation.status as Status] += 1;
  }

  const totalConversations = conversations.length || 1;
  const statusSeries = (Object.keys(statusCounters) as Status[]).map((status) => ({
    status,
    label: STATUS_LABELS[status],
    color: STATUS_COLORS[status],
    count: statusCounters[status],
    percentage: Math.round((statusCounters[status] / totalConversations) * 100),
  }));

  const days = eachDayOfInterval({
    start: startOfDay(last7Days),
    end: endOfDay(new Date()),
  });
  const trendMap = new Map<string, number>();
  for (const day of days) {
    trendMap.set(format(day, "yyyy-MM-dd"), 0);
  }
  for (const conversation of conversations) {
    const key = format(conversation.createdAt, "yyyy-MM-dd");
    if (trendMap.has(key)) {
      trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
    }
  }
  const trendData = days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    return {
      label: format(day, "dd/MM"),
      value: trendMap.get(key) ?? 0,
    };
  });

  const peakTrend = Math.max(...trendData.map((item) => item.value), 1);
  const trendPoints = trendData
    .map((item, index) => {
      const x = (index / Math.max(trendData.length - 1, 1)) * 100;
      const y = 100 - (item.value / peakTrend) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const topDepartment = [...groupedByDepartment].sort(
    (a, b) => b._count._all - a._count._all
  )[0];

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-emerald-50 p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">Dashboard Executivo</h1>
        <p className="mt-1 text-sm text-slate-600">
          Métricas operacionais em tempo real, com visão de desempenho, carga e
          saúde do atendimento.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Atendimentos ativos" value={openAttendances} tone="emerald" />
        <MetricCard title="Clientes ativos (30d)" value={activeCustomers} tone="blue" />
        <MetricCard
          title="Resposta média"
          value={`${avgResponseMinutes} min`}
          tone="violet"
        />
        <MetricCard title="Setores ativos" value={groupedByDepartment.length} tone="slate" />
        <MetricCard title="Encerrados (7d)" value={closedLast7Days} tone="amber" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Tendência de novos atendimentos (7 dias)
            </h2>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
              Pico: {peakTrend}
            </span>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <svg viewBox="0 0 100 100" className="h-44 w-full">
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                points={trendPoints}
              />
            </svg>
            <div className="mt-2 grid grid-cols-7 gap-1 text-[11px] text-slate-500">
              {trendData.map((item) => (
                <span key={item.label} className="text-center">
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            Distribuição por status
          </h2>
          <div className="space-y-3">
            {statusSeries.map((item) => (
              <div key={item.status}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <span className="text-slate-500">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Atendimentos por setor</h2>
          <div className="space-y-3">
            {groupedByDepartment.map((item) => (
              <div key={item.departmentId} className="rounded-xl border border-slate-100 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    {departmentMap.get(item.departmentId) ?? "Desconhecido"}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {item._count._all}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${Math.max(
                        8,
                        Math.round((item._count._all / totalConversations) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {groupedByDepartment.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados para exibir.</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Setor com maior volume</h3>
          <p className="mt-3 text-sm text-slate-600">
            {topDepartment
              ? `${departmentMap.get(topDepartment.departmentId) ?? "Desconhecido"} com ${topDepartment._count._all} atendimentos.`
              : "Sem dados de setor para análise."}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Saúde operacional</h3>
          <p className="mt-3 text-sm text-slate-600">
            {avgResponseMinutes <= 15
              ? "Excelente tempo de resposta. Mantenha o padrão."
              : avgResponseMinutes <= 40
                ? "Tempo de resposta controlado, com espaço para otimização."
                : "Tempo de resposta elevado. Priorize atendimento inicial."}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Base ativa</h3>
          <p className="mt-3 text-sm text-slate-600">
            {activeCustomers} cliente(s) interagiram nos últimos 30 dias.
          </p>
        </article>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string | number;
  tone: "emerald" | "blue" | "violet" | "slate" | "amber";
}) {
  const toneClass = {
    emerald: "from-emerald-100 to-emerald-50 text-emerald-700",
    blue: "from-blue-100 to-blue-50 text-blue-700",
    violet: "from-violet-100 to-violet-50 text-violet-700",
    slate: "from-slate-200 to-slate-50 text-slate-700",
    amber: "from-amber-100 to-amber-50 text-amber-700",
  }[tone];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      <div className={`mt-3 h-2 rounded-full bg-gradient-to-r ${toneClass}`} />
    </article>
  );
}
