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
require("./src/config/env"); // must be first — validates all required env vars before anything else loads
const http_1 = require("http");
const app_1 = __importDefault(require("./src/app"));
const db_1 = __importDefault(require("./src/config/db"));
const socket_service_1 = require("./src/services/socket.service");
const delivery_worker_1 = require("./src/workers/delivery.worker");
const keke_worker_1 = require("./src/workers/keke.worker");
const keke_queue_1 = require("./src/queues/keke.queue");
const node_cron_1 = __importDefault(require("node-cron"));
const axios_1 = __importDefault(require("axios"));
const PORT = parseInt(process.env.PORT || "4250", 10);
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, db_1.default)();
        const server = (0, http_1.createServer)(app_1.default);
        (0, socket_service_1.initSocket)(server);
        // Start background workers
        (0, delivery_worker_1.startDeliveryWorker)();
        (0, keke_worker_1.startKekeWorker)();
        yield (0, keke_queue_1.scheduleReconciliation)(); // keke settlement reconciliation every 15 min
        server.listen(PORT, "0.0.0.0");
        // Ping /health every 20 minutes to prevent Render free-tier sleep
        const selfUrl = process.env.RENDER_EXTERNAL_URL;
        if (selfUrl) {
            node_cron_1.default.schedule("*/20 * * * *", () => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    yield axios_1.default.get(`${selfUrl}/health`, { timeout: 10000 });
                }
                catch (_a) {
                }
            }));
        }
    }
    catch (error) {
        process.exit(1);
    }
});
startServer();
