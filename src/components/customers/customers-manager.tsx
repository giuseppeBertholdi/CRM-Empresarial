"use client";

import { FormEvent, useState } from "react";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  notes: string | null;
  createdAt: string | Date;
  _count: {
    conversations: number;
  };
};

type FormState = {
  name: string;
  phone: string;
  email: string;
  company: string;
  notes: string;
};

const initialFormState: FormState = {
  name: "",
  phone: "",
  email: "",
  company: "",
  notes: "",
};

type CustomersManagerProps = {
  initialCustomers: Customer[];
};

export function CustomersManager({ initialCustomers }: CustomersManagerProps) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(customer: Customer) {
    setEditingCustomerId(customer.id);
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? "",
      company: customer.company ?? "",
      notes: customer.notes ?? "",
    });
  }

  function resetForm() {
    setEditingCustomerId(null);
    setForm(initialFormState);
  }

  async function refreshCustomers() {
    const response = await fetch("/api/customers");
    if (!response.ok) return;
    const payload = (await response.json()) as { customers: Customer[] };
    setCustomers(payload.customers);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email || null,
      company: form.company || null,
      notes: form.notes || null,
    };

    const response = await fetch(
      editingCustomerId ? `/api/customers/${editingCustomerId}` : "/api/customers",
      {
        method: editingCustomerId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setLoading(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(body?.error ?? "Falha ao salvar cliente.");
      return;
    }

    await refreshCustomers();
    resetForm();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2"
      >
        <input
          placeholder="Nome"
          required
          value={form.name}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, name: event.target.value }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Telefone"
          required
          value={form.phone}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, phone: event.target.value }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Email"
          value={form.email}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, email: event.target.value }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Empresa"
          value={form.company}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, company: event.target.value }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="Observações"
          value={form.notes}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, notes: event.target.value }))
          }
          className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">
            {error}
          </p>
        ) : null}
        <div className="md:col-span-2 flex gap-2">
          <button
            disabled={loading}
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading
              ? "Salvando..."
              : editingCustomerId
                ? "Atualizar cliente"
                : "Cadastrar cliente"}
          </button>
          {editingCustomerId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Nome</th>
              <th className="px-4 py-3 font-medium text-slate-600">Telefone</th>
              <th className="px-4 py-3 font-medium text-slate-600">Empresa</th>
              <th className="px-4 py-3 font-medium text-slate-600">Atendimentos</th>
              <th className="px-4 py-3 font-medium text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-800">{customer.name}</td>
                <td className="px-4 py-3 text-slate-600">{customer.phone}</td>
                <td className="px-4 py-3 text-slate-600">{customer.company ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {customer._count?.conversations ?? 0}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => startEdit(customer)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {customers.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={5}>
                  Nenhum cliente cadastrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
