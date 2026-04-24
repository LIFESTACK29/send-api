import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import indexRoute from "./routes/index.route";
import authRoute from "./routes/auth.route";
import userRoute from "./routes/user.route";
import deliveryRoute from "./routes/delivery.route";
import walletRoute from "./routes/wallet.route";
import vehicleRoute from "./routes/vehicle.route";
import documentRoute from "./routes/document.route";
import onboardingRoute from "./routes/onboarding.route";
import adminRoute from "./routes/admin.route";
import errorMiddleware from "./middlewares/error.middleware";

dotenv.config();

const app = express();

// Middleware
app.use(
    cors({
        origin: "*",
    }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api/v1", indexRoute);
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/user", userRoute);
app.use("/api/v1/deliveries", deliveryRoute);
app.use("/api/v1/wallet", walletRoute);
app.use("/api/v1/onboarding", onboardingRoute);
app.use("/api/v1/admin", adminRoute);
app.use("/api/v1/riders", vehicleRoute);
app.use("/api/v1/riders", documentRoute);

// Error handler
app.use(errorMiddleware);

export default app;
