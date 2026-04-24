import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import User from "../models/user.model";

let io: SocketIOServer;

export const initSocket = (server: HttpServer) => {
    io = new SocketIOServer(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    // JWT Authentication middleware for Socket.io
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error("Authentication error: Token missing"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
            socket.data.user = decoded;
            next();
        } catch (err) {
            next(new Error("Authentication error: Invalid token"));
        }
    });

    io.on("connection", (socket: Socket) => {
        const userId = socket.data.user?.userId;
        const role = socket.data.user?.role;

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
                User.findByIdAndUpdate(userId, { isOnline: true }).catch(err =>
                    console.error("Error setting rider online:", err)
                );
                socket.emit("rider_presence", {
                    status: "online",
                    riderId: userId,
                });

                // Handle location updates from rider
                socket.on("update_location", async (data: { lat: number; lng: number }) => {
                    try {
                        const updatedUser = await User.findByIdAndUpdate(userId, {
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
                            name: `${updatedUser?.firstName} ${updatedUser?.lastName}`,
                            coords: { lat: data.lat, lng: data.lng },
                        });
                    } catch (error) {
                        console.error("Error updating rider location:", error);
                    }
                });

                // Handle online status toggle
                socket.on("toggle_online", async (data: { isOnline: boolean }) => {
                    try {
                        await User.findByIdAndUpdate(userId, { isOnline: data.isOnline });
                        console.log(`🔄 Status for rider ${userId} set to: ${data.isOnline ? "ONLINE" : "OFFLINE"}`);

                        // If they go offline, notify discovery pool to remove them
                        if (!data.isOnline) {
                            io.to("rider-discovery").emit("rider_offline", { riderId: userId });
                        }
                    } catch (error) {
                        console.error("Error toggling rider online status:", error);
                    }
                });
            }

            // JOIN/LEAVE discovery for customers
            if (role === "customer") {
                socket.on("join_discovery", () => {
                    socket.join("rider-discovery");
                    console.log(`🔍 Customer ${userId} joined rider-discovery`);

                    // Immediately send current online riders to the new joiner
                    User.find({
                        role: "rider",
                        isOnline: true,
                        riderStatus: "active",
                    }).then(riders => {
                        socket.emit("initial_riders", riders.map(r => ({
                            riderId: r._id,
                            name: `${r.firstName} ${r.lastName}`,
                            profileImageUrl: r.profileImageUrl || null,
                            riderStatus: r.riderStatus || "incomplete",
                            coords: {
                                lat: r.currentLocation?.coordinates[1],
                                lng: r.currentLocation?.coordinates[0]
                            },
                        })));
                    });
                });

                socket.on("leave_discovery", () => {
                    socket.leave("rider-discovery");
                    console.log(`👋 Customer ${userId} left rider-discovery`);
                });
            }
        }

        socket.on("disconnect", async () => {
            console.log(`🔌 Disconnected: ${socket.id}`);
            if (userId && role === "rider") {
                // Set rider as offline when they disconnect
                try {
                    await User.findByIdAndUpdate(userId, { isOnline: false });
                    console.log(`😴 Rider ${userId} is now offline (disconnected)`);
                } catch (error) {
                    console.error("Error setting rider offline on disconnect:", error);
                }
            }
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

/**
 * Emit event to a specific room
 */
export const emitToRoom = (room: string, event: string, data: any) => {
    if (io) {
        io.to(room).emit(event, data);
        console.log(`[Socket] Emitted ${event} to ${room}`);
    }
};

/**
 * Emit event to all riders
 */
export const emitToRiders = (event: string, data: any) => {
    if (io) {
        io.to("riders-pool").emit(event, data);
        console.log(`[Socket] Emitted ${event} to riders-pool`);
    }
};
