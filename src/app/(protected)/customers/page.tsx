import { prisma } from "@/lib/prisma";
import { CustomersManager } from "@/components/customers/customers-manager";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    include: {
      _count: {
        select: { conversations: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
        <p className="text-sm text-slate-500">
          Cadastro e manutenção de clientes atendidos.
        </p>
      </header>

      <CustomersManager
        initialCustomers={JSON.parse(JSON.stringify(customers))}
      />
    </div>
  );
}
