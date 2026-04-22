import { Worker, Job } from "bullmq";
import redisConnection from "../config/redis";
import Delivery from "../models/delivery.model";
import DeliveryMatchRequest from "../models/delivery-match-request.model";
import User from "../models/user.model";
import { addManualAssignmentCheckJob } from "../queues/delivery.queue";
import { emitToRiders, emitToRoom } from "../services/socket.service";

/**
 * Handle the delivery worker logic
 */
export const startDeliveryWorker = () => {
    const worker = new Worker(
        "delivery-matching",
        async (job: Job) => {
            const {
                type,
                deliveryId,
                matchRequestId,
                checkCount = 0,
            } = job.data || {};
            console.log(
                `[Worker] Processing ${type || "UNKNOWN"} | delivery=${deliveryId || "-"} | match=${matchRequestId || "-"}`,
            );

            if (type === "MATCH_REQUEST_BROADCAST") {
                const matchRequest =
                    await DeliveryMatchRequest.findById(matchRequestId);
                if (!matchRequest) return;
                if (matchRequest.status !== "SEARCHING") return;

                emitToRiders("incoming_match_request", {
                    id: matchRequest._id,
                    status: matchRequest.status,
                    pricing: { fee: matchRequest.fee, currency: "NGN" },
                    route: {
                        distanceKm: Number(
                            (matchRequest.distance || 0).toFixed(2),
                        ),
                        pickup: matchRequest.pickupLocation,
                        dropoff: matchRequest.dropoffLocation,
                    },
                    contact: {
                        customer: matchRequest.customer,
                        receiver: matchRequest.receiver,
                    },
                    package: {
                        type: matchRequest.packageType,
                        note: matchRequest.deliveryNote || "",
                        imageUrl: matchRequest.itemImage || null,
                    },
                    matching: {
                        radiusMeters: matchRequest.searchRadiusMeters,
                        timeoutSeconds: matchRequest.timeoutSeconds,
                    },
                    createdAt: matchRequest.createdAt,
                });
                return;
            }

            if (type === "MATCH_REQUEST_TIMEOUT_CHECK") {
                const matchRequest =
                    await DeliveryMatchRequest.findById(matchRequestId);
                if (!matchRequest) return;

                if (matchRequest.status === "SEARCHING") {
                    matchRequest.status = "NO_RIDER_FOUND";
                    await matchRequest.save();

                    emitToRoom(
                        `customer-${matchRequest.customerId}`,
                        "no_rider_found",
                        {
                            matchRequestId: matchRequest._id,
                            status: "no_rider_found",
                            message:
                                "No rider accepted your request yet. You can continue waiting or create it yourself.",
                            actions: [
                                { type: "wait_more", label: "Keep Waiting" },
                                {
                                    type: "create_it_yourself",
                                    label: "Create It Yourself",
                                    style: "primary",
                                },
                            ],
                        },
                    );
                }
                return;
            }

            if (type === "MANUAL_ASSIGNMENT_CHECK") {
                const delivery = await Delivery.findById(deliveryId);
                if (!delivery) return;
                if (delivery.status !== "PENDING" || delivery.riderId) return;

                const nearbyRiders = await User.find({
                    role: "rider",
                    isOnline: true,
                    riderStatus: "active",
                    currentLocation: {
                        $nearSphere: {
                            $geometry: {
                                type: "Point",
                                coordinates: [
                                    delivery.pickupLocation.lng,
                                    delivery.pickupLocation.lat,
                                ],
                            },
                            $maxDistance: 5000,
                        },
                    },
                }).select("_id");

                if (nearbyRiders.length > 0) {
                    nearbyRiders.forEach((rider) => {
                        emitToRoom(
                            `user-${rider._id}`,
                            "incoming_delivery",
                            delivery,
                        );
                    });
                    emitToRoom(
                        `customer-${delivery.customerId}`,
                        "manual_delivery_riders_available",
                        {
                            deliveryId: delivery._id,
                            nearbyRidersCount: nearbyRiders.length,
                            message:
                                "A rider is now close to your pickup location. Your delivery is available for assignment.",
                        },
                    );
                }

                if (
                    checkCount < 20 &&
                    !delivery.riderId &&
                    delivery.status === "PENDING"
                ) {
                    await addManualAssignmentCheckJob(
                        delivery,
                        checkCount + 1,
                        60000,
                    );
                }
                return;
            }
        },
        { connection: redisConnection },
    );

    worker.on("completed", (job) => {
        console.log(`[Worker] Job ${job.id} completed!`);
    });

    worker.on("failed", (job, err) => {
        console.error(
            `[Worker] Job ${job?.id} failed with error: ${err.message}`,
        );
    });

    console.log("🏁 Delivery matching worker started");
};
