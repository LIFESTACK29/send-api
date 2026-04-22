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
exports.addTimeoutJob = exports.addDeliveryJob = exports.deliveryQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = __importDefault(require("../config/redis"));
exports.deliveryQueue = new bullmq_1.Queue("delivery-matching", {
    connection: redis_1.default,
});
/**
 * Add a delivery matching job to the queue
 */
const addDeliveryJob = (delivery) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield exports.deliveryQueue.add(`match-${delivery._id}`, { deliveryId: delivery._id, customerId: delivery.customerId }, {
            attempts: 1, // We'll handle retries manually in the worker for now
            removeOnComplete: true,
            removeOnFail: true,
            delay: 2000, // Small delay for demo
        });
        console.log(`[Queue] Added delivery job for ${delivery._id}`);
    }
    catch (error) {
        console.error(`[Queue] Error adding delivery job to queue:`, error);
    }
});
exports.addDeliveryJob = addDeliveryJob;
/**
 * Add a timeout job that will notify the customer if no rider is found after 60s
 */
const addTimeoutJob = (delivery) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield exports.deliveryQueue.add(`timeout-${delivery._id}`, {
            deliveryId: delivery._id,
            customerId: delivery.customerId,
            type: "TIMEOUT_CHECK"
        }, {
            delay: 60000, // 60 seconds
            removeOnComplete: true,
            removeOnFail: true,
        });
        console.log(`[Queue] Added timeout notification job for ${delivery._id}`);
    }
    catch (error) {
        console.error(`[Queue] Error adding timeout job:`, error);
    }
});
exports.addTimeoutJob = addTimeoutJob;
