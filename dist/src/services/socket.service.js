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
exports.emitToRiders = exports.emitToRoom = exports.getIO = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
let io;
// ─── Haversine distance ───────────────────────────────────────────────────────
const haversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const isValidCoord = (lat, lng) => typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180;
const DISCOVERY_RADIUS_KM = 5;
// Per-socket pickup location for the discovery feature.
// Keyed by socket.id; cleared on leave_discovery and disconnect.
const discoveryPickups = new Map();
// ─── Init ─────────────────────────────────────────────────────────────────────
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            // Mirror app.ts ALLOWED_ORIGINS — mobile apps have no browser origin
            origin: process.env.ALLOWED_ORIGINS
                ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
                : true,
            methods: ["GET", "POST"],
        },
    });
    // JWT auth middleware — accepts token from extraHeaders.Authorization (mobile)
    // or handshake.auth.token (web/legacy)
    io.use((socket, next) => {
        var _a, _b;
        const authHeader = (_a = socket.handshake.headers) === null || _a === void 0 ? void 0 : _a.authorization;
        const token = (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith("Bearer "))
            ? authHeader.slice(7)
            : (_b = socket.handshake.auth) === null || _b === void 0 ? void 0 : _b.token;
        if (!token) {
            return next(new Error("Authentication error: Token missing"));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.data.user = decoded;
            next();
        }
        catch (_c) {
            next(new Error("Authentication error: Invalid token"));
        }
    });
    io.on("connection", (socket) => {
        var _a, _b;
        const userId = (_a = socket.data.user) === null || _a === void 0 ? void 0 : _a.userId;
        const role = (_b = socket.data.user) === null || _b === void 0 ? void 0 : _b.role;
        if (!userId)
            return;
        socket.join(`user-${userId}`);
        if (role === "admin" || role === "operations") {
            socket.join("ops_room");
        }
        // ── Rider handlers ──────────────────────────────────────────────────
        if (role === "rider") {
            socket.join("riders-pool");
            user_model_1.default.findByIdAndUpdate(userId, { isOnline: true }).catch(() => { });
            socket.emit("rider_presence", { status: "online", riderId: userId });
            // Location update — validate coords, filter broadcasts to nearby customers
            socket.on("update_location", (data) => __awaiter(void 0, void 0, void 0, function* () {
                if (!isValidCoord(data.lat, data.lng))
                    return;
                try {
                    yield user_model_1.default.findByIdAndUpdate(userId, {
                        currentLocation: {
                            type: "Point",
                            coordinates: [data.lng, data.lat],
                        },
                        lastLocationUpdate: new Date(),
                    });
                    // Only emit to customers whose pickup is within 5 km
                    const room = io.sockets.adapter.rooms.get("rider-discovery");
                    if (!room)
                        return;
                    for (const socketId of room) {
                        const pickup = discoveryPickups.get(socketId);
                        if (!pickup)
                            continue;
                        const dist = haversineKm(pickup.lat, pickup.lng, data.lat, data.lng);
                        if (dist <= DISCOVERY_RADIUS_KM) {
                            io.to(socketId).emit("rider_location_update", {
                                riderId: userId,
                                // Name intentionally omitted — revealed only after acceptance
                                coords: { lat: data.lat, lng: data.lng },
                            });
                        }
                    }
                }
                catch (error) {
                }
            }));
            // Online/offline toggle
            socket.on("toggle_online", (data) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    yield user_model_1.default.findByIdAndUpdate(userId, {
                        isOnline: data.isOnline,
                    });
                    if (!data.isOnline) {
                        io.to("rider-discovery").emit("rider_offline", {
                            riderId: userId,
                        });
                    }
                }
                catch (error) {
                }
            }));
        }
        // ── Customer handlers ───────────────────────────────────────────────
        if (role === "customer") {
            socket.join(`customer-${userId}`);
            // Customer joins discovery and supplies their pickup coordinates.
            // Only riders within 5 km of that pickup will be sent / streamed.
            socket.on("join_discovery", (data) => {
                var _a, _b;
                socket.join("rider-discovery");
                if (data &&
                    isValidCoord((_a = data.pickupLat) !== null && _a !== void 0 ? _a : NaN, (_b = data.pickupLng) !== null && _b !== void 0 ? _b : NaN)) {
                    discoveryPickups.set(socket.id, {
                        lat: data.pickupLat,
                        lng: data.pickupLng,
                    });
                }
                // Send snapshot of currently online riders within 5 km
                const pickup = discoveryPickups.get(socket.id);
                user_model_1.default.find({
                    role: "rider",
                    isOnline: true,
                    riderStatus: "active",
                })
                    .select("currentLocation profileImageUrl riderStatus")
                    .then((riders) => {
                    const nearby = pickup
                        ? riders.filter((r) => {
                            var _a;
                            const coords = (_a = r.currentLocation) === null || _a === void 0 ? void 0 : _a.coordinates;
                            if (!coords)
                                return false;
                            return (haversineKm(pickup.lat, pickup.lng, coords[1], coords[0]) <= DISCOVERY_RADIUS_KM);
                        })
                        : riders;
                    socket.emit("initial_riders", nearby.map((r) => {
                        var _a, _b;
                        return ({
                            riderId: r._id,
                            profileImage: ((_a = r.riderDetails) === null || _a === void 0 ? void 0 : _a.profileImage) || null,
                            isOnboarded: r.isOnboarded,
                            coords: ((_b = r.currentLocation) === null || _b === void 0 ? void 0 : _b.coordinates)
                                ? {
                                    lat: r.currentLocation.coordinates[1],
                                    lng: r.currentLocation.coordinates[0],
                                }
                                : null,
                        });
                    }));
                })
                    .catch(() => { });
            });
            socket.on("leave_discovery", () => {
                socket.leave("rider-discovery");
                discoveryPickups.delete(socket.id);
            });
        }
        // ── Disconnect ──────────────────────────────────────────────────────
        socket.on("disconnect", () => __awaiter(void 0, void 0, void 0, function* () {
            discoveryPickups.delete(socket.id);
            if (userId && role === "rider") {
                try {
                    yield user_model_1.default.findByIdAndUpdate(userId, { isOnline: false });
                }
                catch (error) {
                }
            }
        }));
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io)
        throw new Error("Socket.io not initialized!");
    return io;
};
exports.getIO = getIO;
const emitToRoom = (room, event, data) => {
    if (io)
        io.to(room).emit(event, data);
};
exports.emitToRoom = emitToRoom;
const emitToRiders = (event, data) => {
    if (io)
        io.to("riders-pool").emit(event, data);
};
exports.emitToRiders = emitToRiders;
