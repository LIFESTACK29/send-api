import { Worker, Job } from "bullmq";
import redisConnection from "../config/redis";
import Delivery from "../models/delivery.model";
import { emitToRiders } from "../services/socket.service";

/**
 * Handle the delivery worker logic
 */
export const startDeliveryWorker = () => {
    const worker = new Worker(
        "delivery-matching",
        async (job: Job) => {
            const { deliveryId, type } = job.data;
            console.log(`[Worker] Processing ${type || "MATCHING"} for ${deliveryId}`);

            const delivery = await Delivery.findById(deliveryId);
            if (!delivery) {
                console.log(`[Worker] Delivery ${deliveryId} not found`);
                return;
            }

            if (delivery.status !== "PENDING") {
                console.log(`[Worker] Delivery ${deliveryId} is no longer pending (Status: ${delivery.status})`);
                return;
            }

            if (type === "TIMEOUT_CHECK") {
                // Inform the specific customer that no rider was found in the initial search
                const { emitToRoom } = require("../services/socket.service");
                emitToRoom(`customer-${delivery.customerId}`, "no_rider_found", {
                    deliveryId,
                    status: "no_rider_found",
                    message:
                        "No rider accepted your delivery yet. You can continue waiting or create it yourself.",
                    actions: [
                        {
                            type: "wait_more",
                            label: "Keep Waiting",
                        },
                        {
                            type: "create_it_yourself",
                            label: "Create It Yourself",
                            style: "primary",
                        },
                    ],
                });
                console.log(`[Worker] No rider found for ${deliveryId}. Notified customer.`);
                return;
            }

            // In a real scenario, this is where we would select nearby riders and broadcast to them specifically
            // For now, we'll broadcast to the entire pool
            emitToRiders("incoming_delivery", delivery);
        },
        { connection: redisConnection }
    );

    worker.on("completed", (job) => {
        console.log(`[Worker] Job ${job.id} completed!`);
    });

    worker.on("failed", (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
    });

    console.log("🏁 Delivery matching worker started");
};
