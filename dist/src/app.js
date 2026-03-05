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
const error_middleware_1 = __importDefault(require("./middlewares/error.middleware"));
const auth_middleware_1 = require("./middlewares/auth.middleware");
dotenv_1.default.config();
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:3000",
        "http://localhost:8081",
        "http://192.168.0.162:4500",
        "http://192.168.0.162:8081",
        process.env.CLIENT_URL || "",
    ].filter(Boolean),
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Clerk — attaches auth info to every request
app.use((0, auth_middleware_1.clerkMiddleware)());
// Public routes
app.use("/api/v1", index_route_1.default);
// Protected routes — require Clerk auth
// Error handler
app.use(error_middleware_1.default);
exports.default = app;
