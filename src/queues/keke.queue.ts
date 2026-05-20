import { Queue } from "bullmq";
import redisConnection from "../config/redis";

export const kekeQueue = new Queue("keke-reconciliation", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
    },
});

export const scheduleReconciliation = async () => {
    // Runs every 15 minutes — add a repeatable job at startup
    await kekeQueue.add(
        "settlement-reconciliation",
        { type: "SETTLEMENT_RECONCILIATION" },
        {
            repeat: { every: 15 * 60 * 1000 }, // 15 minutes
            jobId: "settlement-reconciliation-recurring",
        },
    );
};
