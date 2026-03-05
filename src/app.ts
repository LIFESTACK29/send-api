import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import indexRoute from "./routes/index.route";
import userRoute from "./routes/user.route";
import deliveryRoute from "./routes/delivery.route";
import errorMiddleware from "./middlewares/error.middleware";

import { clerkMiddleware } from "./middlewares/auth.middleware";

dotenv.config();

const app = express();

// Middleware
app.use(clerkMiddleware());
app.use(
    cors({
        origin: "*",
    }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Public routes
app.use("/api/v1", indexRoute);
app.use("/api/v1/user", userRoute);
app.use("/api/v1/deliveries", deliveryRoute);

// Error handler
app.use(errorMiddleware);

export default app;
