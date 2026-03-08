"use client";

import { FormEvent, useState } from "react";
import { Bot, Clock3, PlayCircle, Send, TriangleAlert } from "lucide-react";
import { CONVERSATION_STATUSES, STATUS_LABELS } from "@/lib/constants";

type Role = "ATTENDANT" | "MANAGER" | "ADMIN";

type Department = {
  id: string;
  name: string;
};

type AutomationRule = {
  id: string;
  triggerStatus: (typeof CONVERSATION_STATUSES)[number];
  delayHours: number;
  messageTemplate: string;
  isActive: boolean;
  department: Department | null;
  departmentId?: string | null;
  _count: {
    reminderLogs: number;
  };
};

type AutomationsManagerProps = {
  initialRules: AutomationRule[];
  departments: Department[];
  currentUserRole: Role;
  currentUserDepartmentId: string | null;
  queueEnabled: boolean;
  sentLogsCount: number;
  failedLogsCount: number;
};

const defaultForm = {
  triggerStatus: "QUOTE_SENT" as (typeof CONVERSATION_STATUSES)[number],
  delayHours: 24,
  messageTemplate:
    "Follow-up: {{cliente}}, confirmamos o recebimento da cotação. Atendimento {{atendimentoId}}.",
  isActive: true,
  departmentId: "",
};

export function AutomationsManager({
  initialRules,
  departments,
  currentUserRole,
  currentUserDepartmentId,
  queueEnabled,
  sentLogsCount,
  failedLogsCount,
}: AutomationsManagerProps) {
  const [rules, setRules] = useState<AutomationRule[]>(initialRules);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  async function refreshRules() {
    const response = await fetch("/api/automations");
    if (!response.ok) return;
    const payload = (await response.json()) as { automations: AutomationRule[] };
    setRules(payload.automations);
  }

  function startEdit(rule: AutomationRule) {
    setEditingId(rule.id);
    setForm({
      triggerStatus: rule.triggerStatus,
      delayHours: rule.delayHours,
      messageTemplate: rule.messageTemplate,
      isActive: rule.isActive,
      departmentId: rule.department?.id ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(defaultForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const payload = {
      triggerStatus: form.triggerStatus,
      delayHours: Number(form.delayHours),
      messageTemplate: form.messageTemplate,
      isActive: form.isActive,
      departmentId:
        currentUserRole === "ADMIN"
          ? form.departmentId || null
          : currentUserDepartmentId,
    };

    const response = await fetch(
      editingId ? `/api/automations/${editingId}` : "/api/automations",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    setLoading(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(body?.error ?? "Falha ao salvar regra.");
      return;
    }

    await refreshRules();
    cancelEdit();
    setNotice(editingId ? "Regra atualizada com sucesso." : "Regra criada com sucesso.");
  }

  async function deleteRule(ruleId: string) {
    const confirmed = window.confirm("Deseja excluir esta regra?");
    if (!confirmed) return;

    const response = await fetch(`/api/automations/${ruleId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(body?.error ?? "Falha ao excluir regra.");
      return;
    }

    await refreshRules();
    setNotice("Regra removida com sucesso.");
  }

  async function dispatchPendingAutomations() {
    setDispatching(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/automations/dispatch", { method: "POST" });
    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          result?: {
            processed: number;
            sent: number;
            failed: number;
          };
        }
      | null;

    setDispatching(false);
    if (!response.ok) {
      setError(payload?.error ?? "Falha ao processar automações pendentes.");
      return;
    }

    const result = payload?.result;
    setNotice(
      result
        ? `Processamento concluído: ${result.processed} processadas, ${result.sent} enviadas, ${result.failed} falhas.`
        : "Processamento executado."
    );
    await refreshRules();
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Regras ativas
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {rules.filter((rule) => rule.isActive).length}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mensagens enviadas
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{sentLogsCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Falhas
          </p>
          <p className="mt-2 text-2xl font-semibold text-red-700">{failedLogsCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fila Redis
          </p>
          <p
            className={`mt-2 text-sm font-semibold ${
              queueEnabled ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {queueEnabled ? "Conectada" : "Indisponível (modo manual)"}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PlayCircle size={18} className="text-indigo-600" />
            <p className="text-sm font-semibold text-slate-700">
              Processamento de automações pendentes
            </p>
          </div>
          <button
            type="button"
            onClick={dispatchPendingAutomations}
            disabled={dispatching}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {dispatching ? "Processando..." : "Processar agora"}
          </button>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2"
      >
        <p className="md:col-span-2 text-sm font-semibold text-slate-700">
          {editingId ? "Editar regra automática" : "Nova regra automática"}
        </p>
        <select
          value={form.triggerStatus}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              triggerStatus: event.target.value as (typeof CONVERSATION_STATUSES)[number],
            }))
          }
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        >
          {CONVERSATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={1}
          value={form.delayHours}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              delayHours: Number(event.target.value),
            }))
          }
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          placeholder="Atraso em horas"
        />

        {currentUserRole === "ADMIN" ? (
          <select
            value={form.departmentId}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                departmentId: event.target.value,
              }))
            }
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 md:col-span-2"
          >
            <option value="">Regra global</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        ) : null}

        <textarea
          value={form.messageTemplate}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              messageTemplate: event.target.value,
            }))
          }
          className="min-h-24 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-indigo-500 md:col-span-2"
        />
        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Variáveis disponíveis:</p>
          <p className="mt-1">
            <code>{"{{cliente}}"}</code>, <code>{"{{empresa}}"}</code>,{" "}
            <code>{"{{atendimentoId}}"}</code>
          </p>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                isActive: event.target.checked,
              }))
            }
          />
          Regra ativa
        </label>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 md:col-span-2">
            {notice}
          </p>
        ) : null}

        <div className="flex gap-2 md:col-span-2">
          <button
            disabled={loading}
            type="submit"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Salvando..." : editingId ? "Atualizar regra" : "Criar regra"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className="grid gap-3">
        {rules.map((rule) => (
          <article
            key={rule.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">
                    {STATUS_LABELS[rule.triggerStatus]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                    {rule.department?.name ?? "Global"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      rule.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {rule.isActive ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <p className="text-sm text-slate-700">{rule.messageTemplate}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(rule)}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => deleteRule(rule.id)}
                  className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Excluir
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-2 text-slate-600">
                <Clock3 size={14} className="mb-1 text-slate-500" />
                Atraso: <strong>{rule.delayHours}h</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 text-slate-600">
                <Send size={14} className="mb-1 text-slate-500" />
                Envios da regra: <strong>{rule._count?.reminderLogs ?? 0}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-2 text-slate-600">
                <Bot size={14} className="mb-1 text-slate-500" />
                Motor: <strong>{queueEnabled ? "Fila + worker" : "Manual"}</strong>
              </div>
            </div>
          </article>
        ))}
        {rules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Nenhuma regra cadastrada.
          </div>
        ) : null}
      </div>

      {!queueEnabled ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-start gap-2">
            <TriangleAlert size={16} className="mt-0.5" />
            <p>
              Redis/worker não detectado. As regras ainda funcionam via botão
              <strong> Processar agora</strong> ou endpoint manual.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
