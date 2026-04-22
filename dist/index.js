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
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const http_1 = require("http");
const app_1 = __importDefault(require("./src/app"));
const db_1 = __importDefault(require("./src/config/db"));
const socket_service_1 = require("./src/services/socket.service");
const delivery_worker_1 = require("./src/workers/delivery.worker");
const PORT = parseInt(process.env.PORT || "4250", 10);
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, db_1.default)();
        const server = (0, http_1.createServer)(app_1.default);
        (0, socket_service_1.initSocket)(server);
        // Start background workers
        (0, delivery_worker_1.startDeliveryWorker)();
        server.listen(PORT, "0.0.0.0", () => {
            console.log(`🚀 Server is running on port ${PORT} in ${app_1.default.get("env")} mode`);
        });
    }
    catch (error) {
        console.log("❌ Failed to start the server:", error);
        process.exit(1);
    }
});
startServer();
