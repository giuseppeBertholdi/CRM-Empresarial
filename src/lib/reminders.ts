import { addHours } from "date-fns";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isQueueEnabled, remindersQueue } from "@/lib/queue";

const REMINDER_PENDING_STATUSES = ["SCHEDULED", "PENDING_NO_QUEUE", "FAILED"] as const;

function buildReminderMessage(
  template: string,
  conversation: {
    id: string;
    customer: {
      name: string;
      company: string | null;
    };
  }
) {
  return template
    .replaceAll("{{cliente}}", conversation.customer.name)
    .replaceAll("{{empresa}}", conversation.customer.company ?? "-")
    .replaceAll("{{atendimentoId}}", conversation.id);
}

export async function scheduleRemindersForConversation(
  conversationId: string,
  triggerStatus: ConversationStatus
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { customer: true },
  });

  if (!conversation) {
    return;
  }

  const rules = await prisma.automationRule.findMany({
    where: {
      isActive: true,
      triggerStatus,
      OR: [{ departmentId: null }, { departmentId: conversation.departmentId }],
    },
  });

  for (const rule of rules) {
    const existingPending = await prisma.reminderLog.findFirst({
      where: {
        conversationId: conversation.id,
        ruleId: rule.id,
        sentAt: null,
        status: {
          in: [...REMINDER_PENDING_STATUSES, "PROCESSING"],
        },
      },
      select: { id: true },
    });

    if (existingPending) {
      continue;
    }

    const scheduledFor = addHours(new Date(), rule.delayHours);
    const reminderLog = await prisma.reminderLog.create({
      data: {
        conversationId: conversation.id,
        ruleId: rule.id,
        scheduledFor,
        status: isQueueEnabled() ? "SCHEDULED" : "PENDING_NO_QUEUE",
      },
    });

    if (remindersQueue) {
      const delayMs = Math.max(0, scheduledFor.getTime() - Date.now());
      await remindersQueue.add(
        "send-reminder",
        {
          reminderLogId: reminderLog.id,
          conversationId: conversation.id,
          ruleId: rule.id,
        },
        {
          delay: delayMs,
          attempts: 3,
          backoff: { type: "exponential", delay: 2_000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        }
      );
    }
  }
}

export async function dispatchReminder(reminderLogId: string) {
  const reminderLog = await prisma.reminderLog.findUnique({
    where: { id: reminderLogId },
    include: {
      rule: true,
      conversation: {
        include: {
          customer: true,
        },
      },
    },
  });

  if (!reminderLog || reminderLog.sentAt) {
    return false;
  }

  if (reminderLog.conversation.status !== reminderLog.rule.triggerStatus) {
    await prisma.reminderLog.update({
      where: { id: reminderLog.id },
      data: {
        status: "SKIPPED_STATUS_CHANGED",
      },
    });
    return false;
  }

  const messageContent = buildReminderMessage(
    reminderLog.rule.messageTemplate,
    reminderLog.conversation
  );

  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: reminderLog.conversation.id,
        senderType: "SYSTEM",
        content: messageContent,
      },
    }),
    prisma.conversation.update({
      where: { id: reminderLog.conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
    }),
    prisma.reminderLog.update({
      where: { id: reminderLog.id },
      data: {
        sentAt: new Date(),
        status: "SENT",
      },
    }),
  ]);

  return true;
}

export async function dispatchDueReminders(limit = 100) {
  const dueReminders = await prisma.reminderLog.findMany({
    where: {
      sentAt: null,
      scheduledFor: {
        lte: new Date(),
      },
      status: {
        in: REMINDER_PENDING_STATUSES,
      },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
    select: { id: true, status: true },
  });

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const reminder of dueReminders) {
    const lock = await prisma.reminderLog.updateMany({
      where: {
        id: reminder.id,
        sentAt: null,
        status: reminder.status,
      },
      data: {
        status: "PROCESSING",
      },
    });

    if (lock.count === 0) continue;
    processed += 1;

    try {
      const wasSent = await dispatchReminder(reminder.id);
      if (wasSent) {
        sent += 1;
      }
    } catch {
      failed += 1;
      await prisma.reminderLog.update({
        where: { id: reminder.id },
        data: { status: "FAILED" },
      });
    }
  }

  return {
    processed,
    sent,
    failed,
  };
}
