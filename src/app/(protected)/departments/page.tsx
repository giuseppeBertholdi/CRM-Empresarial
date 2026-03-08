import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { DepartmentsManager } from "@/components/departments/departments-manager";

export default async function DepartmentsPage() {
  const user = await requireCurrentUser();

  if (user.role !== "ADMIN") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Setores</h1>
        <p className="mt-2 text-sm text-slate-500">
          Apenas administradores podem gerenciar setores.
        </p>
      </div>
    );
  }

  const departments = await prisma.department.findMany({
    include: {
      _count: {
        select: {
          users: true,
          conversations: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Setores</h1>
        <p className="text-sm text-slate-500">Gestão de departamentos da operação.</p>
      </header>

      <DepartmentsManager
        initialDepartments={JSON.parse(JSON.stringify(departments))}
      />
    </div>
  );
}
