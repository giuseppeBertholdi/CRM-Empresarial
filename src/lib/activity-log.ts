import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type LogActionInput = {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function logAction(input: LogActionInput) {
  await prisma.activityLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
    },
  });
}
