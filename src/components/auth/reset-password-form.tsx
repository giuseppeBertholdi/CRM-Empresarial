"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ResetPasswordFormProps = {
  tokenHash?: string;
  recoveryType?: string;
};

export function ResetPasswordForm({
  tokenHash,
  recoveryType,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    async function initializeRecoverySession() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setError(
          "Supabase não configurado no frontend. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
        );
        return;
      }

      if (tokenHash && recoveryType === "recovery") {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (verifyError) {
          setError("Link de recuperação inválido ou expirado.");
          return;
        }
        setSessionReady(true);
        return;
      }

      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setSessionError) {
          setError("Não foi possível validar o link de recuperação.");
          return;
        }
        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`
        );
        setSessionReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSessionReady(true);
        return;
      }

      setError("Link de recuperação ausente ou inválido.");
    }

    void initializeRecoverySession();
  }, [tokenHash, recoveryType]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!sessionReady) {
      setError("Sessão de recuperação ainda não validada.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      setError("Supabase não configurado no frontend.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);
    if (updateError) {
      setError("Falha ao redefinir senha.");
      return;
    }

    await supabase.auth.signOut();
    setMessage("Senha redefinida com sucesso.");
    setTimeout(() => {
      router.push("/login");
    }, 1200);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Redefinir senha</h1>
        <p className="text-sm text-slate-500">
          Crie uma nova senha para acessar o CRM.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Nova senha</span>
        <input
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Confirmar senha</span>
        <input
          required
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
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
        {loading ? "Salvando..." : "Atualizar senha"}
      </button>
    </form>
  );
}
