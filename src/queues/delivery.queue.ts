import { Queue } from "bullmq";
import redisConnection from "../config/redis";

export const deliveryQueue = new Queue("delivery-matching", {
    connection: redisConnection,
});

/**
 * Add a delivery matching job to the queue
 */
export const addDeliveryJob = async (delivery: any) => {
    try {
        await deliveryQueue.add(
            `match-${delivery._id}`,
            { deliveryId: delivery._id, customerId: delivery.customerId },
            {
                attempts: 1, // We'll handle retries manually in the worker for now
                removeOnComplete: true,
                removeOnFail: true,
                delay: 2000, // Small delay for demo
            }
        );
        console.log(`[Queue] Added delivery job for ${delivery._id}`);
    } catch (error) {
        console.error(`[Queue] Error adding delivery job to queue:`, error);
    }
};

/**
 * Add a timeout job that will notify the customer if no rider is found after 60s
 */
export const addTimeoutJob = async (delivery: any) => {
    try {
        await deliveryQueue.add(
            `timeout-${delivery._id}`,
            { 
                deliveryId: delivery._id, 
                customerId: delivery.customerId,
                type: "TIMEOUT_CHECK" 
            },
            {
                delay: 60000, // 60 seconds
                removeOnComplete: true,
                removeOnFail: true,
            }
        );
        console.log(`[Queue] Added timeout notification job for ${delivery._id}`);
    } catch (error) {
        console.error(`[Queue] Error adding timeout job:`, error);
    }
};
