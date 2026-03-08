"use client";

import { FormEvent, useState } from "react";

type Department = {
  id: string;
  name: string;
  _count: {
    users: number;
    conversations: number;
  };
};

type DepartmentsManagerProps = {
  initialDepartments: Department[];
};

export function DepartmentsManager({
  initialDepartments,
}: DepartmentsManagerProps) {
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshDepartments() {
    const response = await fetch("/api/departments");
    if (!response.ok) return;
    const payload = (await response.json()) as { departments: Department[] };
    setDepartments(payload.departments);
  }

  function beginEdit(item: Department) {
    setEditingId(item.id);
    setName(item.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch(
      editingId ? `/api/departments/${editingId}` : "/api/departments",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }
    );
    setLoading(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Falha ao salvar setor.");
      return;
    }

    await refreshDepartments();
    cancelEdit();
  }

  async function removeDepartment(id: string) {
    const confirmed = window.confirm("Deseja remover este setor?");
    if (!confirmed) return;

    const response = await fetch(`/api/departments/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Falha ao remover setor.");
      return;
    }

    await refreshDepartments();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome do setor"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            disabled={loading}
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Salvando..." : editingId ? "Atualizar" : "Criar setor"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Cancelar
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Setor</th>
              <th className="px-4 py-3 font-medium text-slate-600">Usuários</th>
              <th className="px-4 py-3 font-medium text-slate-600">Atendimentos</th>
              <th className="px-4 py-3 font-medium text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-800">{department.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  {department._count?.users ?? 0}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {department._count?.conversations ?? 0}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => beginEdit(department)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDepartment(department.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {departments.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={4}>
                  Nenhum setor cadastrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
