"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const index_route_1 = __importDefault(require("./routes/index.route"));
const auth_route_1 = __importDefault(require("./routes/auth.route"));
const user_route_1 = __importDefault(require("./routes/user.route"));
const delivery_route_1 = __importDefault(require("./routes/delivery.route"));
const wallet_route_1 = __importDefault(require("./routes/wallet.route"));
const vehicle_route_1 = __importDefault(require("./routes/vehicle.route"));
const onboarding_route_1 = __importDefault(require("./routes/onboarding.route"));
const admin_route_1 = __importDefault(require("./routes/admin.route"));
const campus_route_1 = __importDefault(require("./routes/campus.route"));
const rides_route_1 = __importDefault(require("./routes/rides.route"));
const keke_route_1 = __importDefault(require("./routes/admin/keke.route"));
const error_middleware_1 = __importDefault(require("./middlewares/error.middleware"));
const app = (0, express_1.default)();
// Security headers
app.use((0, helmet_1.default)());
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : true;
app.use((0, cors_1.default)({ origin: allowedOrigins, credentials: true }));
// Preserve raw body for Paystack webhook signature verification (must be before express.json())
app.use("/api/v1/wallet/webhook", express_1.default.raw({ type: "application/json" }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Routes
app.use("/api/v1", index_route_1.default);
app.use("/api/v1/auth", auth_route_1.default);
app.use("/api/v1/user", user_route_1.default);
app.use("/api/v1/deliveries", delivery_route_1.default);
app.use("/api/v1/wallet", wallet_route_1.default);
app.use("/api/v1/onboarding", onboarding_route_1.default);
app.use("/api/v1/admin", admin_route_1.default);
app.use("/api/v1/riders", vehicle_route_1.default);
app.use("/api/v1/campus", campus_route_1.default);
app.use("/api/v1/rides", rides_route_1.default);
app.use("/api/v1/admin", keke_route_1.default);
// Health check — public, no auth, used by keep-alive cron and uptime monitors
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
// Error handler
app.use(error_middleware_1.default);
exports.default = app;
