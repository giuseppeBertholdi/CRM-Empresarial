import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { Inbox } from "@/components/conversations/inbox";

export default async function ConversationsPage() {
  const user = await requireCurrentUser();
  const scopeFilter =
    user.role === "ADMIN" || !user.departmentId
      ? {}
      : user.role === "ATTENDANT"
        ? { departmentId: user.departmentId, assignedToId: user.id }
        : { departmentId: user.departmentId };

  const [conversations, customers, departments, users] = await Promise.all([
    prisma.conversation.findMany({
      where: scopeFilter,
      include: {
        customer: true,
        department: true,
        assignedTo: {
          select: { id: true, name: true, role: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.department.findMany({
      where:
        user.role === "ADMIN" || !user.departmentId
          ? undefined
          : { id: user.departmentId },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where:
        user.role === "ADMIN" || !user.departmentId
          ? undefined
          : { departmentId: user.departmentId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        departmentId: true,
      },
    }),
  ]);

  const serializedConversations = JSON.parse(JSON.stringify(conversations));
  const serializedCustomers = JSON.parse(JSON.stringify(customers));
  const serializedDepartments = JSON.parse(JSON.stringify(departments));
  const serializedUsers = JSON.parse(JSON.stringify(users));

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-slate-50 to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Inbox de Atendimento
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Atendimento centralizado com CRM + WhatsApp em um fluxo simples.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
            {serializedConversations.length} conversa(s) carregada(s)
          </div>
        </div>
      </header>

      <Inbox
        initialConversations={serializedConversations}
        customers={serializedCustomers}
        departments={serializedDepartments}
        users={serializedUsers}
        currentUser={{
          id: user.id,
          role: user.role,
          departmentId: user.departmentId,
          whatsappPhone: user.whatsappPhone,
        }}
      />
    </div>
  );
}
