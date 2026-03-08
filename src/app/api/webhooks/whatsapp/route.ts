import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

function normalizeDeliveryStatus(value: string | undefined) {
  if (!value) return "UNKNOWN";
  return value.toUpperCase();
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
    token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        entry?: Array<{
          changes?: Array<{
            value?: {
              statuses?: Array<{
                id?: string;
                status?: string;
                timestamp?: string;
                errors?: Array<{ code?: number; title?: string; message?: string }>;
              }>;
            };
          }>;
        }>;
      }
    | null;

  if (!body?.entry?.length) {
    return NextResponse.json({ ok: true });
  }

  for (const entry of body.entry) {
    for (const change of entry.changes ?? []) {
      const statuses = change.value?.statuses ?? [];
      for (const statusItem of statuses) {
        if (!statusItem.id) continue;
        const normalizedStatus = normalizeDeliveryStatus(statusItem.status);
        const deliveryError = statusItem.errors?.[0]?.message ?? null;
        const timestampMs = statusItem.timestamp
          ? Number(statusItem.timestamp) * 1000
          : null;

        await prisma.message.updateMany({
          where: { providerMessageId: statusItem.id },
          data: {
            deliveryStatus: normalizedStatus,
            deliveryError,
            deliveryUpdatedAt: timestampMs ? new Date(timestampMs) : new Date(),
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
