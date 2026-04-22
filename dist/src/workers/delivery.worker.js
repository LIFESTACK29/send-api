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
const socket_service_1 = require("../services/socket.service");
/**
 * Handle the delivery worker logic
 */
const startDeliveryWorker = () => {
    const worker = new bullmq_1.Worker("delivery-matching", (job) => __awaiter(void 0, void 0, void 0, function* () {
        const { deliveryId, type } = job.data;
        console.log(`[Worker] Processing ${type || "MATCHING"} for ${deliveryId}`);
        const delivery = yield delivery_model_1.default.findById(deliveryId);
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
                message: "No rider accepted your delivery yet. You can continue waiting or create it yourself.",
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
        (0, socket_service_1.emitToRiders)("incoming_delivery", delivery);
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
