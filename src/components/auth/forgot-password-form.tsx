"use client";

import { FormEvent, useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    const payload = (await response.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null;

    if (!response.ok) {
      setError(payload?.error ?? "Falha ao processar solicitação.");
      return;
    }

    setMessage(
      payload?.message ??
        "Se o email existir na base, instruções de redefinição serão enviadas."
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Recuperar senha</h1>
        <p className="text-sm text-slate-500">
          Informe seu email para gerar um link de redefinição.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </label>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      <button
        disabled={loading}
        type="submit"
        className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Enviando..." : "Gerar link"}
      </button>
    </form>
  );
}
