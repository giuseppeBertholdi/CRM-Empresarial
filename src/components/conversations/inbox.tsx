"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_LABELS } from "@/lib/constants";
import { buildWhatsappUrl } from "@/lib/whatsapp-shared";

type Role = "ATTENDANT" | "MANAGER" | "ADMIN";
type ConversationStatus = "OPEN" | "WAITING" | "CLOSED" | "QUOTE_SENT";

type ConversationListItem = {
  id: string;
  status: ConversationStatus;
  lastMessageAt: string | Date;
  customer: {
    id: string;
    name: string;
    company: string | null;
  };
  department: {
    id: string;
    name: string;
  };
  assignedTo:
    | {
        id: string;
        name: string;
        role: Role;
      }
    | null
    | undefined;
  messages: Array<{
    content: string;
    createdAt: string | Date;
  }>;
};

type ConversationDetail = {
  id: string;
  status: ConversationStatus;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    company: string | null;
  };
  department: {
    id: string;
    name: string;
  };
  assignedTo:
    | {
        id: string;
        name: string;
        role: Role;
      }
    | null;
  messages: Array<{
    id: string;
    content: string;
    senderType: "USER" | "SYSTEM";
    providerMessageId?: string | null;
    deliveryStatus?: string | null;
    deliveryUpdatedAt?: string | Date | null;
    deliveryError?: string | null;
    createdAt: string | Date;
    sender:
      | {
          id: string;
          name: string;
          role: Role;
        }
      | null;
  }>;
};

type InboxProps = {
  initialConversations: ConversationListItem[];
  customers: Array<{ id: string; name: string; company: string | null }>;
  departments: Array<{ id: string; name: string }>;
  users: Array<{
    id: string;
    name: string;
    role: Role;
    departmentId: string | null;
  }>;
  currentUser: {
    id: string;
    role: Role;
    departmentId: string | null;
    whatsappPhone: string | null;
  };
};

const STATUS_OPTIONS: ConversationStatus[] = [
  "OPEN",
  "WAITING",
  "QUOTE_SENT",
  "CLOSED",
];

const STATUS_BADGE_CLASS: Record<ConversationStatus, string> = {
  OPEN: "bg-emerald-100 text-emerald-700",
  WAITING: "bg-amber-100 text-amber-700",
  QUOTE_SENT: "bg-blue-100 text-blue-700",
  CLOSED: "bg-slate-200 text-slate-700",
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  ACCEPTED: "Aceita",
  SENT: "Enviada",
  DELIVERED: "Entregue",
  READ: "Lida",
  FAILED: "Falhou",
  TEMPLATE_ACCEPTED: "Template aceito",
  UNKNOWN: "Status desconhecido",
};

export function Inbox({
  initialConversations,
  customers,
  departments,
  users,
  currentUser,
}: InboxProps) {
  const [conversations, setConversations] =
    useState<ConversationListItem[]>(initialConversations);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(initialConversations[0]?.id ?? null);
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationDetail | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "ALL">(
    "ALL"
  );
  const [savingWhatsappConfig, setSavingWhatsappConfig] = useState(false);
  const [myWhatsappConfig, setMyWhatsappConfig] = useState({
    whatsappPhone: currentUser.whatsappPhone ?? "",
  });
  const [createForm, setCreateForm] = useState({
    customerId: customers[0]?.id ?? "",
    departmentId: departments[0]?.id ?? "",
    assignedToId: users[0]?.id ?? "",
    initialMessage: "",
  });

  async function refreshConversationList() {
    const response = await fetch("/api/conversations");
    if (!response.ok) return;
    const payload = (await response.json()) as { conversations: ConversationListItem[] };
    setConversations(payload.conversations);
  }

  async function loadConversation(conversationId: string) {
    setLoadingConversation(true);
    setError(null);
    const response = await fetch(`/api/conversations/${conversationId}`);
    setLoadingConversation(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Falha ao carregar conversa.");
      return;
    }
    const payload = (await response.json()) as { conversation: ConversationDetail };
    setSelectedConversation(payload.conversation);
  }

  useEffect(() => {
    if (!selectedConversationId) return;
    void loadConversation(selectedConversationId);
  }, [selectedConversationId]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const byStatus =
        statusFilter === "ALL" ? true : conversation.status === statusFilter;
      const search = searchTerm.trim().toLowerCase();
      const bySearch = !search
        ? true
        : `${conversation.customer.name} ${conversation.customer.company ?? ""} ${
            conversation.messages[0]?.content ?? ""
          }`
            .toLowerCase()
            .includes(search);
      return byStatus && bySearch;
    });
  }, [conversations, searchTerm, statusFilter]);
  const openCount = conversations.filter((item) => item.status === "OPEN").length;
  const waitingCount = conversations.filter((item) => item.status === "WAITING").length;
  const closedCount = conversations.filter((item) => item.status === "CLOSED").length;
  const canUseWhatsApp = myWhatsappConfig.whatsappPhone.trim().length > 0;

  const usersForSelectedDepartment = useMemo(() => {
    return users.filter((user) => {
      if (!createForm.departmentId) return true;
      return user.departmentId === createForm.departmentId;
    });
  }, [createForm.departmentId, users]);

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversationId || !message.trim()) return;

    setError(null);
    setNotice(null);
    const response = await fetch(
      `/api/conversations/${selectedConversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Falha ao enviar mensagem.");
      return;
    }

    setMessage("");
    await Promise.all([
      loadConversation(selectedConversationId),
      refreshConversationList(),
    ]);
  }

  async function handleStatusChange(status: ConversationStatus) {
    if (!selectedConversationId) return;
    setError(null);
    const response = await fetch(`/api/conversations/${selectedConversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Falha ao atualizar status.");
      return;
    }

    await Promise.all([
      loadConversation(selectedConversationId),
      refreshConversationList(),
    ]);
  }

  async function handleCreateConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createForm.customerId || !createForm.departmentId) return;

    setCreateLoading(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: createForm.customerId,
        departmentId: createForm.departmentId,
        assignedToId: createForm.assignedToId || null,
        initialMessage: createForm.initialMessage || undefined,
      }),
    });
    setCreateLoading(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Falha ao abrir atendimento.");
      return;
    }

    const payload = (await response.json()) as { conversation: { id: string } };
    await refreshConversationList();
    setSelectedConversationId(payload.conversation.id);
    setCreateForm((previous) => ({ ...previous, initialMessage: "" }));
    setNotice("Atendimento criado com sucesso.");
  }

  async function handleSendWhatsApp() {
    if (!selectedConversationId || !selectedConversation || !message.trim()) return;
    setWhatsappLoading(true);
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/conversations/${selectedConversationId}/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          message?: string;
          sentViaCloudApi?: boolean;
          providerMessageId?: string | null;
          usedTemplateFallback?: boolean;
        }
      | null;

    setWhatsappLoading(false);

    if (!response.ok) {
      setError(payload?.error ?? "Falha ao enviar mensagem no WhatsApp.");
      return;
    }

    if (payload?.sentViaCloudApi) {
      setMessage("");
      await Promise.all([
        loadConversation(selectedConversationId),
        refreshConversationList(),
      ]);
      setNotice(
        payload.message ??
          "Mensagem aceita pela API do WhatsApp e registrada no CRM."
      );
      return;
    }
    setError(payload?.error ?? "Não foi possível enviar via API do WhatsApp.");
  }

  async function handleSaveMyWhatsAppConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingWhatsappConfig(true);
    setError(null);
    setNotice(null);

    const response = await fetch("/api/auth/me/whatsapp", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whatsappPhone: myWhatsappConfig.whatsappPhone || null,
      }),
    });

    setSavingWhatsappConfig(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Falha ao salvar seu WhatsApp.");
      return;
    }

    setNotice("Seu WhatsApp foi atualizado com sucesso.");
  }

  function openConversationInWhatsApp() {
    if (!selectedConversation) return;
    const waUrl = buildWhatsappUrl(selectedConversation.customer.phone);
    if (!waUrl) {
      setError("Número de telefone inválido para WhatsApp.");
      return;
    }
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Como usar WhatsApp
          </p>
          <p className="mt-2 text-sm text-slate-700">
            1) Salve seu numero. 2) Abra ou selecione uma conversa. 3) Clique em
            {" "}
            &quot;Enviar no WhatsApp&quot;.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Em aberto
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{openCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Aguardando
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{waitingCount}</p>
        </div>
      </section>

      <form
        onSubmit={handleSaveMyWhatsAppConfig}
        className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm md:grid-cols-2"
      >
        <p className="md:col-span-2 text-sm font-semibold text-slate-700">
          Meu WhatsApp (uso individual)
        </p>
        <input
          value={myWhatsappConfig.whatsappPhone}
          onChange={(event) =>
            setMyWhatsappConfig((previous) => ({
              ...previous,
              whatsappPhone: event.target.value,
            }))
          }
          placeholder="Seu número (ex: +55 11 99999-9999)"
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-600">
            Informe somente seu número. O token da API é global no servidor.
          </p>
          <button
            type="submit"
            disabled={savingWhatsappConfig}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {savingWhatsappConfig ? "Salvando..." : "Salvar meu WhatsApp"}
          </button>
        </div>
      </form>

      <form
        onSubmit={handleCreateConversation}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4"
      >
        <p className="md:col-span-4 text-sm font-semibold text-slate-700">
          Novo atendimento
        </p>
        <select
          value={createForm.customerId}
          onChange={(event) =>
            setCreateForm((previous) => ({
              ...previous,
              customerId: event.target.value,
            }))
          }
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>

        <select
          value={createForm.departmentId}
          onChange={(event) =>
            setCreateForm((previous) => ({
              ...previous,
              departmentId: event.target.value,
            }))
          }
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500"
          disabled={currentUser.role !== "ADMIN"}
        >
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>

        <select
          value={createForm.assignedToId}
          onChange={(event) =>
            setCreateForm((previous) => ({
              ...previous,
              assignedToId: event.target.value,
            }))
          }
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500"
          disabled={currentUser.role === "ATTENDANT"}
        >
          <option value="">Sem responsável</option>
          {usersForSelectedDepartment.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={createLoading}
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {createLoading ? "Abrindo..." : "Novo atendimento"}
        </button>

        <input
          value={createForm.initialMessage}
          onChange={(event) =>
            setCreateForm((previous) => ({
              ...previous,
              initialMessage: event.target.value,
            }))
          }
          placeholder="Mensagem inicial (opcional)"
          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 md:col-span-4"
        />
      </form>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      <div className="grid min-h-[650px] gap-4 lg:grid-cols-[280px_360px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Painel JJSul
          </p>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs text-slate-500">Em aberto</p>
              <p className="text-lg font-semibold text-slate-900">{openCount}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-xs text-amber-700">Aguardando</p>
              <p className="text-lg font-semibold text-amber-900">{waitingCount}</p>
            </div>
            <div className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs text-slate-500">Encerradas</p>
              <p className="text-lg font-semibold text-slate-900">{closedCount}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">Fluxo ideal</p>
            <ol className="mt-2 space-y-1 text-xs text-slate-600">
              <li>1. Criar ou selecionar atendimento</li>
              <li>2. Definir status e responsável</li>
              <li>3. Enviar no WhatsApp (automático)</li>
              <li>4. Acompanhar histórico no CRM</li>
            </ol>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Conversas
            </h2>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar cliente ou mensagem..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ConversationStatus | "ALL")
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="ALL">Todos os status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            {filteredConversations.map((conversation) => {
              const isActive = selectedConversationId === conversation.id;
              const preview =
                conversation.messages[0]?.content ??
                "Sem mensagens ainda. Comece o atendimento agora.";
              return (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    isActive
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {conversation.customer.name}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        STATUS_BADGE_CLASS[conversation.status]
                      }`}
                    >
                      {STATUS_LABELS[conversation.status]}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{preview}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{conversation.department.name}</span>
                    <span>
                      {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredConversations.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-500">Nenhuma conversa encontrada.</p>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selectedConversationId ? (
            <div className="p-6 text-sm text-slate-500">
              Selecione uma conversa para visualizar.
            </div>
          ) : loadingConversation ? (
            <div className="p-6 text-sm text-slate-500">Carregando conversa...</div>
          ) : selectedConversation ? (
            <>
              <header className="border-b border-slate-200 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {selectedConversation.customer.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedConversation.customer.company ?? "Sem empresa"} •{" "}
                      {selectedConversation.customer.phone}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                        Setor: {selectedConversation.department.name}
                      </span>
                      {selectedConversation.assignedTo ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                          Responsavel: {selectedConversation.assignedTo.name}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
                          Sem responsavel
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={openConversationInWhatsApp}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Abrir no WhatsApp
                    </button>
                    <select
                      value={selectedConversation.status}
                      onChange={(event) =>
                        handleStatusChange(event.target.value as ConversationStatus)
                      }
                      className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {selectedConversation.messages.map((item) => (
                  <div
                    key={item.id}
                    className={`max-w-[85%] ${
                      item.senderType === "USER" ? "ml-auto" : ""
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm ${
                        item.senderType === "SYSTEM"
                          ? "bg-amber-50 text-amber-900"
                          : "bg-emerald-50 text-emerald-900"
                      }`}
                    >
                      <p>{item.content}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {item.sender?.name ?? "Sistema"} •{" "}
                      {formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                    {item.providerMessageId ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                          WhatsApp:{" "}
                          {DELIVERY_STATUS_LABELS[item.deliveryStatus ?? "UNKNOWN"] ??
                            (item.deliveryStatus ?? "Sem status")}
                        </span>
                        <span className="text-slate-400">
                          id {item.providerMessageId.slice(0, 18)}...
                        </span>
                      </div>
                    ) : null}
                    {item.deliveryError ? (
                      <p className="mt-1 text-[11px] text-red-600">{item.deliveryError}</p>
                    ) : null}
                  </div>
                ))}
                {selectedConversation.messages.length === 0 ? (
                  <p className="text-sm text-slate-500">Ainda sem mensagens.</p>
                ) : null}
              </div>

              <form
                onSubmit={handleSendMessage}
                className="border-t border-slate-200 p-4"
              >
                <div className="flex flex-col gap-2">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={3}
                    placeholder="Digite uma resposta..."
                    className="flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Registrar no CRM
                    </button>
                    <button
                      type="button"
                      onClick={handleSendWhatsApp}
                      disabled={whatsappLoading || !canUseWhatsApp}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {whatsappLoading ? "Enviando..." : "Enviar no WhatsApp"}
                    </button>
                  </div>
                  {!canUseWhatsApp ? (
                    <p className="text-xs text-amber-700">
                      Salve seu numero na caixa &quot;Meu WhatsApp&quot; para
                      habilitar o envio.
                    </p>
                  ) : null}
                </div>
              </form>
            </>
          ) : (
            <div className="p-6 text-sm text-slate-500">
              Não foi possível carregar os detalhes da conversa.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
