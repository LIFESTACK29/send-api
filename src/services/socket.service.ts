import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import User from "../models/user.model";

let io: SocketIOServer;

// ─── Haversine distance ───────────────────────────────────────────────────────

const haversineKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isValidCoord = (lat: number, lng: number): boolean =>
    typeof lat === "number" &&
    typeof lng === "number" &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180;

const DISCOVERY_RADIUS_KM = 5;

// Per-socket pickup location for the discovery feature.
// Keyed by socket.id; cleared on leave_discovery and disconnect.
const discoveryPickups = new Map<string, { lat: number; lng: number }>();

// ─── Init ─────────────────────────────────────────────────────────────────────

export const initSocket = (server: HttpServer) => {
    io = new SocketIOServer(server, {
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
        const authHeader = socket.handshake.headers?.authorization as string | undefined;
        const token = authHeader?.startsWith("Bearer ")
            ? authHeader.slice(7)
            : socket.handshake.auth?.token;

        if (!token) {
            return next(new Error("Authentication error: Token missing"));
        }
        try {
            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET as string,
            ) as any;
            socket.data.user = decoded;
            next();
        } catch {
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket: Socket) => {
        const userId = socket.data.user?.userId as string | undefined;
        const role = socket.data.user?.role as string | undefined;

        if (!userId) return;

        socket.join(`user-${userId}`);

        if (role === "admin" || role === "operations") {
            socket.join("ops_room");
        }

        // ── Rider handlers ──────────────────────────────────────────────────

        if (role === "rider") {
            socket.join("riders-pool");

            User.findByIdAndUpdate(userId, { isOnline: true }).catch(() => {});
            socket.emit("rider_presence", { status: "online", riderId: userId });

            // Location update — validate coords, filter broadcasts to nearby customers
            socket.on(
                "update_location",
                async (data: { lat: number; lng: number }) => {
                    if (!isValidCoord(data.lat, data.lng)) return;

                    try {
                        await User.findByIdAndUpdate(userId, {
                            currentLocation: {
                                type: "Point",
                                coordinates: [data.lng, data.lat],
                            },
                            lastLocationUpdate: new Date(),
                        });

                        // Only emit to customers whose pickup is within 5 km
                        const room = io.sockets.adapter.rooms.get("rider-discovery");
                        if (!room) return;

                        for (const socketId of room) {
                            const pickup = discoveryPickups.get(socketId);
                            if (!pickup) continue;
                            const dist = haversineKm(
                                pickup.lat,
                                pickup.lng,
                                data.lat,
                                data.lng,
                            );
                            if (dist <= DISCOVERY_RADIUS_KM) {
                                io.to(socketId).emit("rider_location_update", {
                                    riderId: userId,
                                    // Name intentionally omitted — revealed only after acceptance
                                    coords: { lat: data.lat, lng: data.lng },
                                });
                            }
                        }
                    } catch (error) {
                    }
                },
            );

            // Online/offline toggle
            socket.on(
                "toggle_online",
                async (data: { isOnline: boolean }) => {
                    try {
                        await User.findByIdAndUpdate(userId, {
                            isOnline: data.isOnline,
                        });
                        if (!data.isOnline) {
                            io.to("rider-discovery").emit("rider_offline", {
                                riderId: userId,
                            });
                        }
                    } catch (error) {
                    }
                },
            );
        }

        // ── Customer handlers ───────────────────────────────────────────────

        if (role === "customer") {
            socket.join(`customer-${userId}`);

            // Customer joins discovery and supplies their pickup coordinates.
            // Only riders within 5 km of that pickup will be sent / streamed.
            socket.on(
                "join_discovery",
                (data?: { pickupLat?: number; pickupLng?: number }) => {
                    socket.join("rider-discovery");

                    if (
                        data &&
                        isValidCoord(data.pickupLat ?? NaN, data.pickupLng ?? NaN)
                    ) {
                        discoveryPickups.set(socket.id, {
                            lat: data.pickupLat as number,
                            lng: data.pickupLng as number,
                        });
                    }

                    // Send snapshot of currently online riders within 5 km
                    const pickup = discoveryPickups.get(socket.id);

                    User.find({
                        role: "rider",
                        isOnline: true,
                        riderStatus: "active",
                    })
                        .select("currentLocation profileImageUrl riderStatus")
                        .then((riders) => {
                            const nearby = pickup
                                ? riders.filter((r) => {
                                      const coords = r.currentLocation?.coordinates;
                                      if (!coords) return false;
                                      return (
                                          haversineKm(
                                              pickup.lat,
                                              pickup.lng,
                                              coords[1],
                                              coords[0],
                                          ) <= DISCOVERY_RADIUS_KM
                                      );
                                  })
                                : riders;

                            socket.emit(
                                "initial_riders",
                                nearby.map((r) => ({
                                    riderId: r._id,
                                    profileImage: r.riderDetails?.profileImage || null,
                                    riderKycApproved: r.riderKycApproved,
                                    coords: r.currentLocation?.coordinates
                                        ? {
                                              lat: r.currentLocation.coordinates[1],
                                              lng: r.currentLocation.coordinates[0],
                                          }
                                        : null,
                                })),
                            );
                        })
                        .catch(() => {});
                },
            );

            socket.on("leave_discovery", () => {
                socket.leave("rider-discovery");
                discoveryPickups.delete(socket.id);
            });
        }

        // ── Disconnect ──────────────────────────────────────────────────────

        socket.on("disconnect", async () => {
            discoveryPickups.delete(socket.id);

            if (userId && role === "rider") {
                try {
                    await User.findByIdAndUpdate(userId, { isOnline: false });
                } catch (error) {
                }
            }
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) throw new Error("Socket.io not initialized!");
    return io;
};

export const emitToRoom = (room: string, event: string, data: any) => {
    if (io) io.to(room).emit(event, data);
};

export const emitToRiders = (event: string, data: any) => {
    if (io) io.to("riders-pool").emit(event, data);
};
