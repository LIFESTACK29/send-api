import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import Delivery from "../models/delivery.model";
import User from "../models/user.model";
import Vehicle from "../models/vehicle.model";
import { emitToRoom, emitToRiders } from "../services/socket.service";
import { addDeliveryJob, addTimeoutJob } from "../queues/delivery.queue";
import { AuthRequest } from "../types/user.type";
import { getUserId } from "../middlewares/auth.middleware";
import { uploadToStorage } from "../middlewares/upload.middleware";

const BASE_FEE_NAIRA = 1000;
const PER_KM_FEE_NAIRA = 200;
const MATCH_RADIUS_METERS = 5000;
const MATCH_TIMEOUT_SECONDS = 60;

/**
 * Calculate distance between two points in km using Haversine formula
 */
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
};

const parseLocation = (rawLocation: any) => {
    let location = rawLocation;

    if (typeof location === "string") {
        try {
            location = JSON.parse(location);
        } catch {
            return { error: "Invalid location payload format" as const };
        }
    }

    if (!location || typeof location !== "object") {
        return { error: "Location is required" as const };
    }

    const lat = Number(location.lat ?? location.latitude);
    const lng = Number(location.lng ?? location.longitude ?? location.lon);
    const address = String(
        location.address ??
            location.placeName ??
            location.place_name ??
            "",
    ).trim();

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { error: "Location coordinates are invalid" as const };
    }

    if (!address) {
        return { error: "Location address is required" as const };
    }

    return {
        value: {
            address,
            lat,
            lng,
            shortName: String(location.shortName ?? location.text ?? "").trim(),
        },
    };
};

const parseContactDetails = (rawDetails: any, label: "Customer" | "Receiver") => {
    let details = rawDetails;

    if (typeof details === "string") {
        try {
            details = JSON.parse(details);
        } catch {
            return { error: `${label} details payload format is invalid` as const };
        }
    }

    if (!details || typeof details !== "object") {
        return { error: `${label} details are required` as const };
    }

    const fullName = String(details.fullName ?? "").trim();
    const email = String(details.email ?? "").trim();
    const phoneNumber = String(details.phoneNumber ?? "").trim();

    if (!fullName || !email || !phoneNumber) {
        return {
            error: `${label} fullName, email, and phoneNumber are required` as const,
        };
    }

    return {
        value: {
            fullName,
            email,
            phoneNumber,
        },
    };
};

const createMobileDeliveryResponse = (delivery: any, nearbyRidersCount: number) => ({
    id: delivery._id,
    trackingId: delivery.trackingId,
    status: delivery.status,
    pricing: {
        fee: delivery.fee,
        currency: "NGN",
    },
    route: {
        distanceKm: Number((delivery.distance || 0).toFixed(2)),
        pickup: delivery.pickupLocation,
        dropoff: delivery.dropoffLocation,
    },
    contact: {
        customer: delivery.customer,
        receiver: delivery.receiver,
    },
    package: {
        type: delivery.packageType,
        note: delivery.deliveryNote || "",
        imageUrl: delivery.itemImage || null,
    },
    matching: {
        strategy: nearbyRidersCount > 0 ? "nearby_first" : "broadcast_all_online",
        nearbyRidersCount,
        radiusMeters: MATCH_RADIUS_METERS,
        timeoutSeconds: MATCH_TIMEOUT_SECONDS,
    },
    createdAt: delivery.createdAt,
});

const buildRiderPreview = async (riderId: string) => {
    const riderUser = await User.findById(riderId).select(
        "firstName lastName profileImageUrl riderStatus phoneNumber",
    );
    if (!riderUser) return null;

    const riderVehicle = await Vehicle.findOne({ userId: riderId })
        .sort({ updatedAt: -1 })
        .select("vehicleType brand model color licensePlate");

    return {
        id: riderId,
        firstName: riderUser.firstName,
        lastName: riderUser.lastName,
        fullName: `${riderUser.firstName} ${riderUser.lastName}`,
        profileImageUrl: riderUser.profileImageUrl || null,
        riderStatus: riderUser.riderStatus || "incomplete",
        phoneNumber: riderUser.phoneNumber || "",
        vehicle: riderVehicle
            ? {
                  type: riderVehicle.vehicleType,
                  brand: riderVehicle.brand,
                  model: riderVehicle.model,
                  color: riderVehicle.color,
                  licensePlate: riderVehicle.licensePlate,
              }
            : null,
    };
};

/**
 * @desc    Calculate delivery fee based on coordinates
 * @route   POST /api/v1/deliveries/calculate-fee
 * @access  Private (Customer)
 */
export const calculateDeliveryFee = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const pickupParsed = parseLocation(req.body.pickupLocation);
        const dropoffParsed = parseLocation(req.body.dropoffLocation);

        if ("error" in pickupParsed || "error" in dropoffParsed) {
            res.status(400).json({
                success: false,
                message:
                    "error" in pickupParsed
                        ? pickupParsed.error
                        : dropoffParsed.error,
            });
            return;
        }

        const pickupLocation = pickupParsed.value;
        const dropoffLocation = dropoffParsed.value;

        const distance = getDistance(
            pickupLocation.lat,
            pickupLocation.lng,
            dropoffLocation.lat,
            dropoffLocation.lng,
        );

        const distanceFee = Math.ceil(distance * PER_KM_FEE_NAIRA);
        const fee = Math.ceil(BASE_FEE_NAIRA + distanceFee);

        res.status(200).json({
            success: true,
            data: {
                distanceKm: Number(distance.toFixed(2)),
                pricing: {
                    baseFee: BASE_FEE_NAIRA,
                    distanceFee,
                    totalFee: fee,
                    currency: "NGN",
                },
                route: {
                    pickupLocation,
                    dropoffLocation,
                },
            },
            // Backward-compatible fields
            distance,
            fee,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Customer requests a new delivery
 * @route   POST /api/v1/deliveries/request
 * @access  Private (Customer)
 */
export const requestDelivery = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const customerId = getUserId(req);
        if (!customerId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        let {
            pickupLocation,
            dropoffLocation,
            packageType,
            deliveryNote,
            customer,
            receiver,
        } = req.body;

        const pickupParsed = parseLocation(pickupLocation);
        const dropoffParsed = parseLocation(dropoffLocation);
        if ("error" in pickupParsed || "error" in dropoffParsed) {
            res.status(400).json({
                success: false,
                message:
                    "error" in pickupParsed
                        ? pickupParsed.error
                        : dropoffParsed.error,
            });
            return;
        }

        pickupLocation = pickupParsed.value;
        dropoffLocation = dropoffParsed.value;

        if (!packageType) {
            res.status(400).json({
                success: false,
                message: "Package type is required",
            });
            return;
        }

        const customerParsed = parseContactDetails(
            customer ?? {
                fullName: req.body.customerFullName,
                email: req.body.customerEmail,
                phoneNumber: req.body.customerPhoneNumber,
            },
            "Customer",
        );
        if ("error" in customerParsed) {
            res.status(400).json({
                success: false,
                message: customerParsed.error,
            });
            return;
        }

        const receiverParsed = parseContactDetails(
            receiver ?? {
                fullName: req.body.receiverFullName,
                email: req.body.receiverEmail,
                phoneNumber: req.body.receiverPhoneNumber,
            },
            "Receiver",
        );
        if ("error" in receiverParsed) {
            res.status(400).json({
                success: false,
                message: receiverParsed.error,
            });
            return;
        }

        if (!req.file) {
            res.status(400).json({
                success: false,
                message: "Package image is required. Please upload what you are sending.",
                code: "ITEM_IMAGE_REQUIRED",
            });
            return;
        }

        // Calculate distance and fee
        const distance = getDistance(
            pickupLocation.lat,
            pickupLocation.lng,
            dropoffLocation.lat,
            dropoffLocation.lng,
        );

        const calculatedFee = Math.ceil(BASE_FEE_NAIRA + distance * PER_KM_FEE_NAIRA);

        // Package image is mandatory
        const itemImage = await uploadToStorage(req.file, "deliveries");

        // Generate a simple tracking ID
        const trackingId = `RS-${new Date()
            .toISOString()
            .split("T")[0]
            .replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newDelivery = await Delivery.create({
            trackingId,
            pickupLocation,
            dropoffLocation,
            customer: customerParsed.value,
            receiver: receiverParsed.value,
            packageType,
            deliveryNote,
            itemImage,
            distance,
            fee: calculatedFee,
            status: "PENDING",
            customerId,
        });

        // 1. Find online riders within 5km radius
        const nearbyRiders = await User.find({
            role: "rider",
            isOnline: true,
            riderStatus: "active",
            currentLocation: {
                $nearSphere: {
                    $geometry: {
                        type: "Point",
                        coordinates: [pickupLocation.lng, pickupLocation.lat], // [lng, lat]
                    },
                    $maxDistance: MATCH_RADIUS_METERS,
                },
            },
        });

        if (nearbyRiders.length > 0) {
            console.log(`[Matching] Found ${nearbyRiders.length} nearby riders for ${newDelivery._id}`);
            // Notify each nearby rider specifically
            nearbyRiders.forEach((rider) => {
                emitToRoom(`user-${rider._id}`, "incoming_delivery", newDelivery);
            });
        } else {
            console.log(`[Matching] No nearby riders found for ${newDelivery._id}. Broadcasting to all.`);
            // Fallback: Notify all online riders if no one is nearby
            emitToRiders("incoming_delivery", newDelivery);
        }

        // Add to matching queue and timeout job
        await addDeliveryJob(newDelivery);
        await addTimeoutJob(newDelivery);

        res.status(201).json({
            success: true,
            message: "Delivery request created and rider matching started",
            delivery: createMobileDeliveryResponse(newDelivery, nearbyRiders.length),
            nextAction: {
                state: "searching_for_rider",
                socketEvents: {
                    onAccepted: "delivery_accepted",
                    onNoRiderFound: "no_rider_found",
                },
                fallback: {
                    type: "create_it_yourself",
                    label: "Create It Yourself",
                    description:
                        "If no rider accepts within 60 seconds, you can choose to create the delivery yourself.",
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get nearby available riders (for Customer app visibility)
 * @route   GET /api/v1/deliveries/nearby-riders
 * @access  Private (Customer)
 */
export const getNearbyRiders = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const { lat, lng, radius = 5000 } = req.query;

        if (!lat || !lng) {
            res.status(400).json({ message: "Coordinates are required" });
            return;
        }

        const riders = await User.find({
            role: "rider",
            isOnline: true,
            riderStatus: "active",
            currentLocation: {
                $nearSphere: {
                    $geometry: {
                        type: "Point",
                        coordinates: [Number(lng), Number(lat)],
                    },
                    $maxDistance: Number(radius),
                },
            },
        }).select(
            "firstName lastName currentLocation riderStatus profileImageUrl lastLocationUpdate",
        );

        const riderCards = riders.map((rider: any) => ({
            id: rider._id,
            firstName: rider.firstName,
            lastName: rider.lastName,
            fullName: `${rider.firstName} ${rider.lastName}`,
            profileImageUrl: rider.profileImageUrl || null,
            riderStatus: rider.riderStatus || "incomplete",
            isOnline: true,
            location: {
                lat: rider.currentLocation?.coordinates?.[1],
                lng: rider.currentLocation?.coordinates?.[0],
            },
            lastLocationUpdate: rider.lastLocationUpdate || null,
        }));

        res.status(200).json({
            success: true,
            count: riderCards.length,
            riders: riderCards,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Rider accepts a delivery
 * @route   POST /api/v1/deliveries/:id/accept
 * @access  Private (Rider)
 */
export const acceptDelivery = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const riderId = getUserId(req);
        if (!riderId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { id } = req.params;

        const delivery = await Delivery.findById(id);

        if (!delivery) {
            res.status(404).json({ message: "Delivery not found" });
            return;
        }

        if (delivery.status !== "PENDING") {
            res.status(400).json({
                message: "Delivery is no longer available/pending",
            });
            return;
        }

        delivery.status = "ONGOING";
        delivery.riderId = riderId;
        await delivery.save();

        const riderDetails = await buildRiderPreview(riderId);

        const payload = {
            delivery,
            rider: riderDetails,
        };

        // Inform the specific customer that their delivery was accepted
        emitToRoom(`customer-${delivery.customerId}`, "delivery_accepted", payload);

        res.status(200).json({
            success: true,
            message: "Delivery accepted successfully",
            delivery,
            rider: riderDetails,
        });
    } catch (error) {
        next(error);
    }
};
/**
 * @desc    Customer cancels a delivery
 * @route   POST /api/v1/deliveries/:id/cancel
 * @access  Private (Customer)
 */
export const cancelDelivery = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const customerId = getUserId(req);
        if (!customerId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const { id } = req.params;
        const delivery = await Delivery.findById(id);

        if (!delivery) {
            res.status(404).json({ message: "Delivery not found" });
            return;
        }

        if (String(delivery.customerId) !== String(customerId)) {
            res.status(403).json({ message: "Forbidden: Not your delivery" });
            return;
        }

        if (delivery.status !== "PENDING") {
            res.status(400).json({
                message: "Delivery can only be cancelled while pending",
            });
            return;
        }

        delivery.status = "CANCELLED";
        await delivery.save();

        res.status(200).json({
            message: "Delivery cancelled successfully",
            delivery,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get current user's (customer) deliveries
 * @route   GET /api/v1/deliveries/my-deliveries
 * @access  Private (Customer)
 */
export const getMyDeliveries = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const customerId = getUserId(req);
        if (!customerId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        // Use a more robust query to handle potential type inconsistencies (String vs ObjectId)
        const query: any = {
            $or: [
                { customerId: customerId },
                { riderId: customerId },
            ]
        };

        // If it's a valid ObjectId hex string, also look for it as an actual ObjectId
        if (mongoose.Types.ObjectId.isValid(customerId)) {
            const objectId = new mongoose.Types.ObjectId(customerId);
            query.$or.push({ customerId: objectId });
            query.$or.push({ riderId: objectId });
        }

        const deliveries = await Delivery.find(query)
            .sort({ createdAt: -1 })
            .populate(
                "riderId",
                "firstName lastName profileImageUrl riderStatus phoneNumber",
            );

        const mobileDeliveries = deliveries.map((delivery: any) => ({
            id: delivery._id,
            trackingId: delivery.trackingId,
            status: delivery.status,
            pricing: {
                fee: delivery.fee,
                currency: "NGN",
            },
            route: {
                distanceKm: Number((delivery.distance || 0).toFixed(2)),
                pickup: delivery.pickupLocation,
                dropoff: delivery.dropoffLocation,
            },
            contact: {
                customer: delivery.customer,
                receiver: delivery.receiver,
            },
            package: {
                type: delivery.packageType,
                note: delivery.deliveryNote || "",
                imageUrl: delivery.itemImage || null,
            },
            rider: delivery.riderId
                ? {
                      id: delivery.riderId._id,
                      fullName: `${delivery.riderId.firstName} ${delivery.riderId.lastName}`,
                      profileImageUrl: delivery.riderId.profileImageUrl || null,
                      riderStatus: delivery.riderId.riderStatus || "incomplete",
                      phoneNumber: delivery.riderId.phoneNumber || "",
                  }
                : null,
            createdAt: delivery.createdAt,
            updatedAt: delivery.updatedAt,
        }));

        res.status(200).json({
            success: true,
            deliveries: mobileDeliveries,
        });
    } catch (error) {
        next(error);
    }
};
/**
 * @desc    Get a single delivery detail
 * @route   GET /api/v1/deliveries/:id
 * @access  Private (Customer/Rider)
 */
export const getDeliveryById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const { id } = req.params;
        
        // Find by ID, supporting both String and ObjectId types
        const query: any = { _id: id };
        if (mongoose.Types.ObjectId.isValid(id)) {
            query._id = { $in: [id, new mongoose.Types.ObjectId(id)] };
        }

        const delivery = await Delivery.findOne(query).populate(
            "riderId",
            "firstName lastName profileImageUrl riderStatus phoneNumber",
        );

        if (!delivery) {
            res.status(404).json({ message: "Delivery not found" });
            return;
        }

        res.status(200).json({
            success: true,
            delivery: {
                id: delivery._id,
                trackingId: delivery.trackingId,
                status: delivery.status,
                pricing: {
                    fee: delivery.fee,
                    currency: "NGN",
                },
                route: {
                    distanceKm: Number((delivery.distance || 0).toFixed(2)),
                    pickup: delivery.pickupLocation,
                    dropoff: delivery.dropoffLocation,
                },
                contact: {
                    customer: delivery.customer,
                    receiver: delivery.receiver,
                },
                package: {
                    type: delivery.packageType,
                    note: delivery.deliveryNote || "",
                    imageUrl: delivery.itemImage || null,
                },
                rider: delivery.riderId
                    ? {
                          id: (delivery.riderId as any)._id,
                          fullName: `${(delivery.riderId as any).firstName} ${(delivery.riderId as any).lastName}`,
                          profileImageUrl:
                              (delivery.riderId as any).profileImageUrl || null,
                          riderStatus:
                              (delivery.riderId as any).riderStatus || "incomplete",
                          phoneNumber: (delivery.riderId as any).phoneNumber || "",
                      }
                    : null,
                customerId: delivery.customerId,
                createdAt: delivery.createdAt,
                updatedAt: delivery.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};
