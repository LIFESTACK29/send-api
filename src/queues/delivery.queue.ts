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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
    }
};
