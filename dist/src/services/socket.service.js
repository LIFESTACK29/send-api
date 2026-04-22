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
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    // JWT Authentication middleware for Socket.io
    io.use((socket, next) => {
        var _a;
        const token = (_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token;
        if (!token) {
            return next(new Error("Authentication error: Token missing"));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            socket.data.user = decoded;
            next();
        }
        catch (err) {
            next(new Error("Authentication error: Invalid token"));
        }
    });
    io.on("connection", (socket) => {
        var _a, _b;
        const userId = (_a = socket.data.user) === null || _a === void 0 ? void 0 : _a.userId;
        const role = (_b = socket.data.user) === null || _b === void 0 ? void 0 : _b.role;
        console.log(`📡 New connection: ${socket.id} (User: ${userId}, Role: ${role})`);
        // Join user-specific room
        if (userId) {
            socket.join(`user-${userId}`);
            // If they are a customer, join customer room
            if (role === "customer") {
                socket.join(`customer-${userId}`);
            }
            // If they are a rider, join the riders pool
            if (role === "rider") {
                socket.join("riders-pool");
                console.log(`🚴 Rider ${userId} joined the riders-pool`);
                // Set rider as online when they connect
                user_model_1.default.findByIdAndUpdate(userId, { isOnline: true }).catch(err => console.error("Error setting rider online:", err));
                // Handle location updates from rider
                socket.on("update_location", (data) => __awaiter(void 0, void 0, void 0, function* () {
                    try {
                        const updatedUser = yield user_model_1.default.findByIdAndUpdate(userId, {
                            currentLocation: {
                                type: "Point",
                                coordinates: [data.lng, data.lat], // MongoDB coordinates are [lng, lat]
                            },
                            lastLocationUpdate: new Date(),
                        }, { new: true });
                        console.log(`📍 Location updated for rider ${userId}: ${data.lat}, ${data.lng}`);
                        // BROADCAST to all customers in the discovery pool
                        io.to("rider-discovery").emit("rider_location_update", {
                            riderId: userId,
                            name: `${updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.firstName} ${updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.lastName}`,
                            coords: { lat: data.lat, lng: data.lng },
                        });
                    }
                    catch (error) {
                        console.error("Error updating rider location:", error);
                    }
                }));
                // Handle online status toggle
                socket.on("toggle_online", (data) => __awaiter(void 0, void 0, void 0, function* () {
                    try {
                        yield user_model_1.default.findByIdAndUpdate(userId, { isOnline: data.isOnline });
                        console.log(`🔄 Status for rider ${userId} set to: ${data.isOnline ? "ONLINE" : "OFFLINE"}`);
                        // If they go offline, notify discovery pool to remove them
                        if (!data.isOnline) {
                            io.to("rider-discovery").emit("rider_offline", { riderId: userId });
                        }
                    }
                    catch (error) {
                        console.error("Error toggling rider online status:", error);
                    }
                }));
            }
            // JOIN/LEAVE discovery for customers
            if (role === "customer") {
                socket.on("join_discovery", () => {
                    socket.join("rider-discovery");
                    console.log(`🔍 Customer ${userId} joined rider-discovery`);
                    // Immediately send current online riders to the new joiner
                    user_model_1.default.find({
                        role: "rider",
                        isOnline: true,
                        riderStatus: "active",
                    }).then(riders => {
                        socket.emit("initial_riders", riders.map(r => {
                            var _a, _b;
                            return ({
                                riderId: r._id,
                                name: `${r.firstName} ${r.lastName}`,
                                profileImageUrl: r.profileImageUrl || null,
                                riderStatus: r.riderStatus || "incomplete",
                                coords: {
                                    lat: (_a = r.currentLocation) === null || _a === void 0 ? void 0 : _a.coordinates[1],
                                    lng: (_b = r.currentLocation) === null || _b === void 0 ? void 0 : _b.coordinates[0]
                                },
                            });
                        }));
                    });
                });
                socket.on("leave_discovery", () => {
                    socket.leave("rider-discovery");
                    console.log(`👋 Customer ${userId} left rider-discovery`);
                });
            }
        }
        socket.on("disconnect", () => __awaiter(void 0, void 0, void 0, function* () {
            console.log(`🔌 Disconnected: ${socket.id}`);
            if (userId && role === "rider") {
                // Set rider as offline when they disconnect
                try {
                    yield user_model_1.default.findByIdAndUpdate(userId, { isOnline: false });
                    console.log(`😴 Rider ${userId} is now offline (disconnected)`);
                }
                catch (error) {
                    console.error("Error setting rider offline on disconnect:", error);
                }
            }
        }));
    });
    return io;
};
exports.initSocket = initSocket;
const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};
exports.getIO = getIO;
/**
 * Emit event to a specific room
 */
const emitToRoom = (room, event, data) => {
    if (io) {
        io.to(room).emit(event, data);
        console.log(`[Socket] Emitted ${event} to ${room}`);
    }
};
exports.emitToRoom = emitToRoom;
/**
 * Emit event to all riders
 */
const emitToRiders = (event, data) => {
    if (io) {
        io.to("riders-pool").emit(event, data);
        console.log(`[Socket] Emitted ${event} to riders-pool`);
    }
};
exports.emitToRiders = emitToRiders;
