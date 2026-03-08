"use client";

import { FormEvent, useState } from "react";
import { ROLE_LABELS } from "@/lib/constants";

type Department = {
  id: string;
  name: string;
};

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: "ATTENDANT" | "MANAGER" | "ADMIN";
  department: Department | null;
  whatsappPhone: string | null;
};

type UsersManagerProps = {
  initialUsers: UserItem[];
  departments: Department[];
};

const defaultForm = {
  name: "",
  email: "",
  password: "",
  role: "ATTENDANT" as UserItem["role"],
  departmentId: "",
  whatsappPhone: "",
};

export function UsersManager({ initialUsers, departments }: UsersManagerProps) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [form, setForm] = useState(defaultForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshUsers() {
    const response = await fetch("/api/users");
    if (!response.ok) return;
    const payload = (await response.json()) as { users: UserItem[] };
    setUsers(payload.users);
  }

  function startEdit(user: UserItem) {
    setEditingUserId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      departmentId: user.department?.id ?? "",
      whatsappPhone: user.whatsappPhone ?? "",
    });
  }

  function cancelEdit() {
    setEditingUserId(null);
    setForm(defaultForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      name: form.name,
      email: form.email,
      password: form.password || undefined,
      role: form.role,
      departmentId: form.departmentId || null,
      whatsappPhone: form.whatsappPhone || null,
    };

    const response = await fetch(
      editingUserId ? `/api/users/${editingUserId}` : "/api/users",
      {
        method: editingUserId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    setLoading(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(body?.error ?? "Falha ao salvar usuário.");
      return;
    }

    await refreshUsers();
    cancelEdit();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2"
      >
        <input
          required
          placeholder="Nome"
          value={form.name}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, name: event.target.value }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          required={!editingUserId}
          type="email"
          disabled={Boolean(editingUserId)}
          placeholder="Email"
          value={form.email}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, email: event.target.value }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
        />

        <input
          type="password"
          placeholder={editingUserId ? "Nova senha (opcional)" : "Senha"}
          value={form.password}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, password: event.target.value }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <select
          value={form.role}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              role: event.target.value as UserItem["role"],
            }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ATTENDANT">Atendente</option>
          <option value="MANAGER">Gerente</option>
          <option value="ADMIN">Admin</option>
        </select>

        <select
          value={form.departmentId}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              departmentId: event.target.value,
            }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        >
          <option value="">Sem setor</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>

        <input
          placeholder="WhatsApp do usuário"
          value={form.whatsappPhone}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              whatsappPhone: event.target.value,
            }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 md:col-span-2">
          <button
            disabled={loading}
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading
              ? "Salvando..."
              : editingUserId
                ? "Atualizar usuário"
                : "Cadastrar usuário"}
          </button>
          {editingUserId ? (
            <button
              type="button"
              onClick={cancelEdit}
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
              <th className="px-4 py-3 font-medium text-slate-600">Email</th>
              <th className="px-4 py-3 font-medium text-slate-600">Papel</th>
              <th className="px-4 py-3 font-medium text-slate-600">Setor</th>
              <th className="px-4 py-3 font-medium text-slate-600">WhatsApp</th>
              <th className="px-4 py-3 font-medium text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-800">{user.name}</td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[user.role]}</td>
                <td className="px-4 py-3 text-slate-600">{user.department?.name ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{user.whatsappPhone ?? "-"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => startEdit(user)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={6}>
                  Nenhum usuário cadastrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
