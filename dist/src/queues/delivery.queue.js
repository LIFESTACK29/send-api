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
exports.addManualAssignmentCheckJob = exports.addMatchRequestTimeoutJob = exports.addMatchRequestBroadcastJob = exports.deliveryQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = __importDefault(require("../config/redis"));
exports.deliveryQueue = new bullmq_1.Queue("delivery-matching", {
    connection: redis_1.default,
});
/**
 * Re-broadcast a match request to riders.
 */
const addMatchRequestBroadcastJob = (matchRequest) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield exports.deliveryQueue.add(`match-request-broadcast-${matchRequest._id}-${Date.now()}`, {
            type: "MATCH_REQUEST_BROADCAST",
            matchRequestId: matchRequest._id,
            customerId: matchRequest.customerId,
        }, {
            attempts: 1,
            removeOnComplete: true,
            removeOnFail: true,
            delay: 2000,
        });
        console.log(`[Queue] Added match request broadcast job for ${matchRequest._id}`);
    }
    catch (error) {
        console.error(`[Queue] Error adding match request broadcast job:`, error);
    }
});
exports.addMatchRequestBroadcastJob = addMatchRequestBroadcastJob;
/**
 * Add timeout check for a match request search window.
 */
const addMatchRequestTimeoutJob = (matchRequest) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield exports.deliveryQueue.add(`match-request-timeout-${matchRequest._id}-${Date.now()}`, {
            type: "MATCH_REQUEST_TIMEOUT_CHECK",
            matchRequestId: matchRequest._id,
            customerId: matchRequest.customerId,
        }, {
            delay: (matchRequest.timeoutSeconds || 60) * 1000,
            removeOnComplete: true,
            removeOnFail: true,
        });
        console.log(`[Queue] Added match request timeout job for ${matchRequest._id}`);
    }
    catch (error) {
        console.error(`[Queue] Error adding match request timeout job:`, error);
    }
});
exports.addMatchRequestTimeoutJob = addMatchRequestTimeoutJob;
/**
 * For manual deliveries without assigned rider, periodically check nearby riders.
 */
const addManualAssignmentCheckJob = (delivery_1, ...args_1) => __awaiter(void 0, [delivery_1, ...args_1], void 0, function* (delivery, checkCount = 0, delayMs = 60000) {
    try {
        yield exports.deliveryQueue.add(`manual-assignment-check-${delivery._id}-${Date.now()}`, {
            type: "MANUAL_ASSIGNMENT_CHECK",
            deliveryId: delivery._id,
            customerId: delivery.customerId,
            checkCount,
        }, {
            delay: delayMs,
            removeOnComplete: true,
            removeOnFail: true,
        });
        console.log(`[Queue] Added manual assignment check job for ${delivery._id} (check ${checkCount})`);
    }
    catch (error) {
        console.error(`[Queue] Error adding manual assignment check job:`, error);
    }
});
exports.addManualAssignmentCheckJob = addManualAssignmentCheckJob;
