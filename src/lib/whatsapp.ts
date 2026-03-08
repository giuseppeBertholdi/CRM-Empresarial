import { env } from "@/lib/env";
import {
  buildWhatsappUrl,
  normalizePhoneForWhatsapp,
} from "@/lib/whatsapp-shared";

export { buildWhatsappUrl, normalizePhoneForWhatsapp };

export function hasWhatsAppCloudConfig() {
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

type SendWhatsAppTextParams = {
  phone: string;
  text: string;
  fallbackTemplateName?: string;
  fallbackTemplateLanguage?: string;
  cloudConfig?: {
    phoneNumberId?: string | null;
    accessToken?: string | null;
    apiVersion?: string | null;
  };
  allowEnvFallback?: boolean;
};

type WhatsAppApiOkPayload = {
  messages?: Array<{ id?: string; message_status?: string }>;
  contacts?: Array<{ wa_id?: string }>;
};
type WhatsAppApiErrorPayload = {
  error?: { message?: string; code?: number; error_subcode?: number };
};

type SendRequestResult = {
  ok: boolean;
  reason: string | null;
  providerMessageId: string | null;
  providerStatus: string | null;
  errorCode: number | null;
  errorSubcode: number | null;
};

function resolveCloudConfig(
  cloudConfig: SendWhatsAppTextParams["cloudConfig"],
  allowEnvFallback: boolean
) {
  return {
    phoneNumberId:
      cloudConfig?.phoneNumberId ??
      (allowEnvFallback ? env.WHATSAPP_PHONE_NUMBER_ID : ""),
    accessToken:
      cloudConfig?.accessToken ??
      (allowEnvFallback ? env.WHATSAPP_ACCESS_TOKEN : ""),
    apiVersion:
      cloudConfig?.apiVersion ??
      (allowEnvFallback ? env.WHATSAPP_API_VERSION : "v21.0"),
  };
}

async function sendWhatsAppRequest(
  url: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<SendRequestResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const providerPayload = (await response.json().catch(() => null)) as
    | WhatsAppApiOkPayload
    | WhatsAppApiErrorPayload
    | null;

  if (!response.ok) {
    const providerError = providerPayload as WhatsAppApiErrorPayload | null;
    const providerMessage = providerError?.error?.message ?? null;
    return {
      ok: false,
      reason: providerMessage
        ? `Falha ao enviar pela API do WhatsApp: ${providerMessage}`
        : "Falha ao enviar mensagem pela API do WhatsApp.",
      providerMessageId: null,
      providerStatus: null,
      errorCode: providerError?.error?.code ?? null,
      errorSubcode: providerError?.error?.error_subcode ?? null,
    };
  }

  const providerOk = providerPayload as WhatsAppApiOkPayload | null;
  const providerMessageId = providerOk?.messages?.[0]?.id ?? null;
  const providerStatus = providerOk?.messages?.[0]?.message_status ?? "accepted";

  if (!providerMessageId) {
    return {
      ok: false,
      reason:
        "A API do WhatsApp respondeu sem ID de mensagem. Verifique permissões e payload.",
      providerMessageId: null,
      providerStatus: null,
      errorCode: null,
      errorSubcode: null,
    };
  }

  return {
    ok: true,
    reason: null,
    providerMessageId,
    providerStatus,
    errorCode: null,
    errorSubcode: null,
  };
}

function canFallbackToTemplate(result: SendRequestResult) {
  if (!result.reason) return false;
  const reason = result.reason.toLowerCase();
  return (
    reason.includes("outside the allowed window") ||
    reason.includes("customer care window") ||
    reason.includes("24 hours") ||
    result.errorCode === 131047
  );
}

export async function sendWhatsAppText({
  phone,
  text,
  fallbackTemplateName = "hello_world",
  fallbackTemplateLanguage = "en_US",
  cloudConfig,
  allowEnvFallback = true,
}: SendWhatsAppTextParams) {
  const normalizedPhone = normalizePhoneForWhatsapp(phone);
  if (!normalizedPhone) {
    return {
      sent: false,
      reason: "Número de telefone inválido para WhatsApp.",
      waUrl: null as string | null,
    };
  }

  const waUrl = buildWhatsappUrl(phone, text);
  const {
    phoneNumberId: resolvedPhoneNumberId,
    accessToken: resolvedAccessToken,
    apiVersion: resolvedApiVersion,
  } = resolveCloudConfig(cloudConfig, allowEnvFallback);

  if (!resolvedPhoneNumberId || !resolvedAccessToken) {
    return {
      sent: false,
      reason: "API do WhatsApp não configurada no servidor.",
      waUrl,
      providerMessageId: null as string | null,
      providerStatus: null as string | null,
      usedTemplateFallback: false,
    };
  }

  const endpointUrl = `https://graph.facebook.com/${resolvedApiVersion}/${resolvedPhoneNumberId}/messages`;
  const textResult = await sendWhatsAppRequest(endpointUrl, resolvedAccessToken, {
    messaging_product: "whatsapp",
    to: normalizedPhone,
    type: "text",
    text: {
      body: text,
    },
  });

  if (textResult.ok) {
    return {
      sent: true,
      reason: null as string | null,
      waUrl,
      providerMessageId: textResult.providerMessageId,
      providerStatus: textResult.providerStatus,
      usedTemplateFallback: false,
    };
  }

  if (!canFallbackToTemplate(textResult)) {
    return {
      sent: false,
      reason: textResult.reason,
      waUrl,
      providerMessageId: null as string | null,
      providerStatus: null as string | null,
      usedTemplateFallback: false,
    };
  }

  const templateResult = await sendWhatsAppRequest(endpointUrl, resolvedAccessToken, {
    messaging_product: "whatsapp",
    to: normalizedPhone,
    type: "template",
    template: {
      name: fallbackTemplateName,
      language: {
        code: fallbackTemplateLanguage,
      },
    },
  });

  if (!templateResult.ok) {
    return {
      sent: false,
      reason: templateResult.reason ?? textResult.reason,
      waUrl,
      providerMessageId: null as string | null,
      providerStatus: null as string | null,
      usedTemplateFallback: false,
    };
  }

  return {
    sent: true,
    reason:
      "Mensagem enviada via template de fallback (janela de 24h fechada para texto livre).",
    waUrl,
    providerMessageId: templateResult.providerMessageId,
    providerStatus: templateResult.providerStatus,
    usedTemplateFallback: true,
  };
}

