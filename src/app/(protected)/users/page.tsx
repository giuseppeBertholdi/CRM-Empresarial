import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { UsersManager } from "@/components/users/users-manager";

export default async function UsersPage() {
  const user = await requireCurrentUser();

  if (user.role !== "ADMIN") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Usuários</h1>
        <p className="mt-2 text-sm text-slate-500">
          Apenas administradores podem gerenciar usuários.
        </p>
      </div>
    );
  }

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      include: { department: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Usuários</h1>
        <p className="text-sm text-slate-500">
          Controle de acesso por setor e papel (RBAC).
        </p>
      </header>

      <UsersManager
        initialUsers={JSON.parse(JSON.stringify(users))}
        departments={JSON.parse(JSON.stringify(departments))}
      />
    </div>
  );
}
