import "./src/config/env"; // must be first — validates all required env vars before anything else loads

import { createServer } from "http";
import app from "./src/app";
import connectDB from "./src/config/db";
import { initSocket } from "./src/services/socket.service";
import { startDeliveryWorker } from "./src/workers/delivery.worker";
import { startKekeWorker } from "./src/workers/keke.worker";
import { scheduleReconciliation } from "./src/queues/keke.queue";
import cron from "node-cron";
import axios from "axios";

const PORT: number = parseInt(process.env.PORT || "4250", 10);

const startServer = async () => {
    try {
        await connectDB();

        const server = createServer(app);
        initSocket(server);

        // Start background workers
        startDeliveryWorker();
        startKekeWorker();
        await scheduleReconciliation(); // keke settlement reconciliation every 15 min

        server.listen(PORT, "0.0.0.0");

        // Ping /health every 20 minutes to prevent Render free-tier sleep
        const selfUrl = process.env.RENDER_EXTERNAL_URL;
        if (selfUrl) {
            cron.schedule("*/20 * * * *", async () => {
                try {
                    await axios.get(`${selfUrl}/health`, { timeout: 10000 });
                } catch {
                }
            });
        }
    } catch (error) {
        process.exit(1);
    }
};

startServer();
