import { Worker } from "bullmq";
import { dispatchDueReminders, dispatchReminder } from "@/lib/reminders";
import { getQueueConnection } from "@/lib/queue";

async function startWorker() {
  const connection = getQueueConnection();
  if (!connection) {
    console.error("REDIS_URL não configurada. Worker não iniciado.");
    process.exit(1);
  }

  const worker = new Worker(
    "reminders",
    async (job) => {
      const { reminderLogId } = job.data as { reminderLogId: string };
      await dispatchReminder(reminderLogId);
    },
    { connection }
  );

  worker.on("completed", (job) => {
    console.log(`Lembrete processado: ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Falha ao processar job ${job?.id}:`, error);
  });

  const fallbackTimer = setInterval(async () => {
    const result = await dispatchDueReminders(100);
    if (result.processed > 0) {
      console.log(
        `Fallback de lembretes: processados=${result.processed} enviados=${result.sent} falhas=${result.failed}`
      );
    }
  }, 60_000);

  process.on("SIGTERM", () => clearInterval(fallbackTimer));
  process.on("SIGINT", () => clearInterval(fallbackTimer));

  console.log("Worker de lembretes iniciado.");
}

void startWorker();
