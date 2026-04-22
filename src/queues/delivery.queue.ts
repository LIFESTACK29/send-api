import { Queue } from "bullmq";
import redisConnection from "../config/redis";

export const deliveryQueue = new Queue("delivery-matching", {
    connection: redisConnection,
});

/**
 * Re-broadcast a match request to riders.
 */
export const addMatchRequestBroadcastJob = async (matchRequest: any) => {
    try {
        await deliveryQueue.add(
            `match-request-broadcast-${matchRequest._id}-${Date.now()}`,
            {
                type: "MATCH_REQUEST_BROADCAST",
                matchRequestId: matchRequest._id,
                customerId: matchRequest.customerId,
            },
            {
                attempts: 1,
                removeOnComplete: true,
                removeOnFail: true,
                delay: 2000,
            },
        );
        console.log(`[Queue] Added match request broadcast job for ${matchRequest._id}`);
    } catch (error) {
        console.error(`[Queue] Error adding match request broadcast job:`, error);
    }
};

/**
 * Add timeout check for a match request search window.
 */
export const addMatchRequestTimeoutJob = async (matchRequest: any) => {
    try {
        await deliveryQueue.add(
            `match-request-timeout-${matchRequest._id}-${Date.now()}`,
            {
                type: "MATCH_REQUEST_TIMEOUT_CHECK",
                matchRequestId: matchRequest._id,
                customerId: matchRequest.customerId,
            },
            {
                delay: (matchRequest.timeoutSeconds || 60) * 1000,
                removeOnComplete: true,
                removeOnFail: true,
            },
        );
        console.log(`[Queue] Added match request timeout job for ${matchRequest._id}`);
    } catch (error) {
        console.error(`[Queue] Error adding match request timeout job:`, error);
    }
};

/**
 * For manual deliveries without assigned rider, periodically check nearby riders.
 */
export const addManualAssignmentCheckJob = async (
    delivery: any,
    checkCount = 0,
    delayMs = 60000,
) => {
    try {
        await deliveryQueue.add(
            `manual-assignment-check-${delivery._id}-${Date.now()}`,
            {
                type: "MANUAL_ASSIGNMENT_CHECK",
                deliveryId: delivery._id,
                customerId: delivery.customerId,
                checkCount,
            },
            {
                delay: delayMs,
                removeOnComplete: true,
                removeOnFail: true,
            },
        );
        console.log(
            `[Queue] Added manual assignment check job for ${delivery._id} (check ${checkCount})`,
        );
    } catch (error) {
        console.error(`[Queue] Error adding manual assignment check job:`, error);
    }
};
