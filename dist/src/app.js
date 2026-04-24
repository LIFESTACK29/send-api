"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const index_route_1 = __importDefault(require("./routes/index.route"));
const auth_route_1 = __importDefault(require("./routes/auth.route"));
const user_route_1 = __importDefault(require("./routes/user.route"));
const delivery_route_1 = __importDefault(require("./routes/delivery.route"));
const wallet_route_1 = __importDefault(require("./routes/wallet.route"));
const vehicle_route_1 = __importDefault(require("./routes/vehicle.route"));
const document_route_1 = __importDefault(require("./routes/document.route"));
const onboarding_route_1 = __importDefault(require("./routes/onboarding.route"));
const admin_route_1 = __importDefault(require("./routes/admin.route"));
const error_middleware_1 = __importDefault(require("./middlewares/error.middleware"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({
    origin: "*",
}));
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
app.use("/api/v1/riders", document_route_1.default);
// Error handler
app.use(error_middleware_1.default);
exports.default = app;
