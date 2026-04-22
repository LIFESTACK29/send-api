"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDeliveryWorker = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = __importDefault(require("../config/redis"));
const delivery_model_1 = __importDefault(require("../models/delivery.model"));
const delivery_match_request_model_1 = __importDefault(require("../models/delivery-match-request.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const delivery_queue_1 = require("../queues/delivery.queue");
const socket_service_1 = require("../services/socket.service");
/**
 * Handle the delivery worker logic
 */
const startDeliveryWorker = () => {
    const worker = new bullmq_1.Worker("delivery-matching", (job) => __awaiter(void 0, void 0, void 0, function* () {
        const { type, deliveryId, matchRequestId, checkCount = 0, } = job.data || {};
        console.log(`[Worker] Processing ${type || "UNKNOWN"} | delivery=${deliveryId || "-"} | match=${matchRequestId || "-"}`);
        if (type === "MATCH_REQUEST_BROADCAST") {
            const matchRequest = yield delivery_match_request_model_1.default.findById(matchRequestId);
            if (!matchRequest)
                return;
            if (matchRequest.status !== "SEARCHING")
                return;
            (0, socket_service_1.emitToRiders)("incoming_match_request", {
                id: matchRequest._id,
                status: matchRequest.status,
                pricing: { fee: matchRequest.fee, currency: "NGN" },
                route: {
                    distanceKm: Number((matchRequest.distance || 0).toFixed(2)),
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
            const matchRequest = yield delivery_match_request_model_1.default.findById(matchRequestId);
            if (!matchRequest)
                return;
            if (matchRequest.status === "SEARCHING") {
                matchRequest.status = "NO_RIDER_FOUND";
                yield matchRequest.save();
                (0, socket_service_1.emitToRoom)(`customer-${matchRequest.customerId}`, "no_rider_found", {
                    matchRequestId: matchRequest._id,
                    status: "no_rider_found",
                    message: "No rider accepted your request yet. You can continue waiting or create it yourself.",
                    actions: [
                        { type: "wait_more", label: "Keep Waiting" },
                        {
                            type: "create_it_yourself",
                            label: "Create It Yourself",
                            style: "primary",
                        },
                    ],
                });
            }
            return;
        }
        if (type === "MANUAL_ASSIGNMENT_CHECK") {
            const delivery = yield delivery_model_1.default.findById(deliveryId);
            if (!delivery)
                return;
            if (delivery.status !== "PENDING" || delivery.riderId)
                return;
            const nearbyRiders = yield user_model_1.default.find({
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
                    (0, socket_service_1.emitToRoom)(`user-${rider._id}`, "incoming_delivery", delivery);
                });
                (0, socket_service_1.emitToRoom)(`customer-${delivery.customerId}`, "manual_delivery_riders_available", {
                    deliveryId: delivery._id,
                    nearbyRidersCount: nearbyRiders.length,
                    message: "A rider is now close to your pickup location. Your delivery is available for assignment.",
                });
            }
            if (checkCount < 20 &&
                !delivery.riderId &&
                delivery.status === "PENDING") {
                yield (0, delivery_queue_1.addManualAssignmentCheckJob)(delivery, checkCount + 1, 60000);
            }
            return;
        }
    }), { connection: redis_1.default });
    worker.on("completed", (job) => {
        console.log(`[Worker] Job ${job.id} completed!`);
    });
    worker.on("failed", (job, err) => {
        console.error(`[Worker] Job ${job === null || job === void 0 ? void 0 : job.id} failed with error: ${err.message}`);
    });
    console.log("🏁 Delivery matching worker started");
};
exports.startDeliveryWorker = startDeliveryWorker;
