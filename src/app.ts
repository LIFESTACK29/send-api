import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import indexRoute from "./routes/index.route";
import authRoute from "./routes/auth.route";
import userRoute from "./routes/user.route";
import deliveryRoute from "./routes/delivery.route";
import walletRoute from "./routes/wallet.route";
import vehicleRoute from "./routes/vehicle.route";
import onboardingRoute from "./routes/onboarding.route";
import adminRoute from "./routes/admin.route";
import campusRoute from "./routes/campus.route";
import ridesRoute from "./routes/rides.route";
import kekeAdminRoute from "./routes/admin/keke.route";
import errorMiddleware from "./middlewares/error.middleware";

const app = express();

// Security headers
app.use(helmet());

// CORS — restrict to explicitly listed origins; set ALLOWED_ORIGINS in .env
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : [];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl, Postman in dev)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error(`CORS: origin '${origin}' not allowed`));
        },
        credentials: true,
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
app.use("/api/v1/campus", campusRoute);
app.use("/api/v1/rides", ridesRoute);
app.use("/api/v1/admin", kekeAdminRoute);

// Error handler
app.use(errorMiddleware);

export default app;
