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
exports.getDeliveryById = exports.getMyDeliveries = exports.cancelDelivery = exports.acceptDelivery = exports.getNearbyRiders = exports.requestDelivery = exports.calculateDeliveryFee = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const delivery_model_1 = __importDefault(require("../models/delivery.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const vehicle_model_1 = __importDefault(require("../models/vehicle.model"));
const socket_service_1 = require("../services/socket.service");
const delivery_queue_1 = require("../queues/delivery.queue");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const BASE_FEE_NAIRA = 1000;
const PER_KM_FEE_NAIRA = 200;
const MATCH_RADIUS_METERS = 5000;
const MATCH_TIMEOUT_SECONDS = 60;
/**
 * Calculate distance between two points in km using Haversine formula
 */
const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
const parseLocation = (rawLocation) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    let location = rawLocation;
    if (typeof location === "string") {
        try {
            location = JSON.parse(location);
        }
        catch (_j) {
            return { error: "Invalid location payload format" };
        }
    }
    if (!location || typeof location !== "object") {
        return { error: "Location is required" };
    }
    const lat = Number((_a = location.lat) !== null && _a !== void 0 ? _a : location.latitude);
    const lng = Number((_c = (_b = location.lng) !== null && _b !== void 0 ? _b : location.longitude) !== null && _c !== void 0 ? _c : location.lon);
    const address = String((_f = (_e = (_d = location.address) !== null && _d !== void 0 ? _d : location.placeName) !== null && _e !== void 0 ? _e : location.place_name) !== null && _f !== void 0 ? _f : "").trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { error: "Location coordinates are invalid" };
    }
    if (!address) {
        return { error: "Location address is required" };
    }
    return {
        value: {
            address,
            lat,
            lng,
            shortName: String((_h = (_g = location.shortName) !== null && _g !== void 0 ? _g : location.text) !== null && _h !== void 0 ? _h : "").trim(),
        },
    };
};
const parseContactDetails = (rawDetails, label) => {
    var _a, _b, _c;
    let details = rawDetails;
    if (typeof details === "string") {
        try {
            details = JSON.parse(details);
        }
        catch (_d) {
            return { error: `${label} details payload format is invalid` };
        }
    }
    if (!details || typeof details !== "object") {
        return { error: `${label} details are required` };
    }
    const fullName = String((_a = details.fullName) !== null && _a !== void 0 ? _a : "").trim();
    const email = String((_b = details.email) !== null && _b !== void 0 ? _b : "").trim();
    const phoneNumber = String((_c = details.phoneNumber) !== null && _c !== void 0 ? _c : "").trim();
    if (!fullName || !email || !phoneNumber) {
        return {
            error: `${label} fullName, email, and phoneNumber are required`,
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
const createMobileDeliveryResponse = (delivery, nearbyRidersCount) => ({
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
const buildRiderPreview = (riderId) => __awaiter(void 0, void 0, void 0, function* () {
    const riderUser = yield user_model_1.default.findById(riderId).select("firstName lastName profileImageUrl riderStatus phoneNumber");
    if (!riderUser)
        return null;
    const riderVehicle = yield vehicle_model_1.default.findOne({ userId: riderId })
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
});
/**
 * @desc    Calculate delivery fee based on coordinates
 * @route   POST /api/v1/deliveries/calculate-fee
 * @access  Private (Customer)
 */
const calculateDeliveryFee = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const pickupParsed = parseLocation(req.body.pickupLocation);
        const dropoffParsed = parseLocation(req.body.dropoffLocation);
        if ("error" in pickupParsed || "error" in dropoffParsed) {
            res.status(400).json({
                success: false,
                message: "error" in pickupParsed
                    ? pickupParsed.error
                    : dropoffParsed.error,
            });
            return;
        }
        const pickupLocation = pickupParsed.value;
        const dropoffLocation = dropoffParsed.value;
        const distance = getDistance(pickupLocation.lat, pickupLocation.lng, dropoffLocation.lat, dropoffLocation.lng);
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
    }
    catch (error) {
        next(error);
    }
});
exports.calculateDeliveryFee = calculateDeliveryFee;
/**
 * @desc    Customer requests a new delivery
 * @route   POST /api/v1/deliveries/request
 * @access  Private (Customer)
 */
const requestDelivery = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const customerId = (0, auth_middleware_1.getUserId)(req);
        if (!customerId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        let { pickupLocation, dropoffLocation, packageType, deliveryNote, customer, receiver, } = req.body;
        const pickupParsed = parseLocation(pickupLocation);
        const dropoffParsed = parseLocation(dropoffLocation);
        if ("error" in pickupParsed || "error" in dropoffParsed) {
            res.status(400).json({
                success: false,
                message: "error" in pickupParsed
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
        const customerParsed = parseContactDetails(customer !== null && customer !== void 0 ? customer : {
            fullName: req.body.customerFullName,
            email: req.body.customerEmail,
            phoneNumber: req.body.customerPhoneNumber,
        }, "Customer");
        if ("error" in customerParsed) {
            res.status(400).json({
                success: false,
                message: customerParsed.error,
            });
            return;
        }
        const receiverParsed = parseContactDetails(receiver !== null && receiver !== void 0 ? receiver : {
            fullName: req.body.receiverFullName,
            email: req.body.receiverEmail,
            phoneNumber: req.body.receiverPhoneNumber,
        }, "Receiver");
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
        const distance = getDistance(pickupLocation.lat, pickupLocation.lng, dropoffLocation.lat, dropoffLocation.lng);
        const calculatedFee = Math.ceil(BASE_FEE_NAIRA + distance * PER_KM_FEE_NAIRA);
        // Package image is mandatory
        const itemImage = yield (0, upload_middleware_1.uploadToStorage)(req.file, "deliveries");
        // Generate a simple tracking ID
        const trackingId = `RS-${new Date()
            .toISOString()
            .split("T")[0]
            .replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
        const newDelivery = yield delivery_model_1.default.create({
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
        const nearbyRiders = yield user_model_1.default.find({
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
                (0, socket_service_1.emitToRoom)(`user-${rider._id}`, "incoming_delivery", newDelivery);
            });
        }
        else {
            console.log(`[Matching] No nearby riders found for ${newDelivery._id}. Broadcasting to all.`);
            // Fallback: Notify all online riders if no one is nearby
            (0, socket_service_1.emitToRiders)("incoming_delivery", newDelivery);
        }
        // Add to matching queue and timeout job
        yield (0, delivery_queue_1.addDeliveryJob)(newDelivery);
        yield (0, delivery_queue_1.addTimeoutJob)(newDelivery);
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
                    description: "If no rider accepts within 60 seconds, you can choose to create the delivery yourself.",
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.requestDelivery = requestDelivery;
/**
 * @desc    Get nearby available riders (for Customer app visibility)
 * @route   GET /api/v1/deliveries/nearby-riders
 * @access  Private (Customer)
 */
const getNearbyRiders = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { lat, lng, radius = 5000 } = req.query;
        if (!lat || !lng) {
            res.status(400).json({ message: "Coordinates are required" });
            return;
        }
        const riders = yield user_model_1.default.find({
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
        }).select("firstName lastName currentLocation riderStatus profileImageUrl lastLocationUpdate");
        const riderCards = riders.map((rider) => {
            var _a, _b, _c, _d;
            return ({
                id: rider._id,
                firstName: rider.firstName,
                lastName: rider.lastName,
                fullName: `${rider.firstName} ${rider.lastName}`,
                profileImageUrl: rider.profileImageUrl || null,
                riderStatus: rider.riderStatus || "incomplete",
                isOnline: true,
                location: {
                    lat: (_b = (_a = rider.currentLocation) === null || _a === void 0 ? void 0 : _a.coordinates) === null || _b === void 0 ? void 0 : _b[1],
                    lng: (_d = (_c = rider.currentLocation) === null || _c === void 0 ? void 0 : _c.coordinates) === null || _d === void 0 ? void 0 : _d[0],
                },
                lastLocationUpdate: rider.lastLocationUpdate || null,
            });
        });
        res.status(200).json({
            success: true,
            count: riderCards.length,
            riders: riderCards,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getNearbyRiders = getNearbyRiders;
/**
 * @desc    Rider accepts a delivery
 * @route   POST /api/v1/deliveries/:id/accept
 * @access  Private (Rider)
 */
const acceptDelivery = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const riderId = (0, auth_middleware_1.getUserId)(req);
        if (!riderId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { id } = req.params;
        const delivery = yield delivery_model_1.default.findById(id);
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
        yield delivery.save();
        const riderDetails = yield buildRiderPreview(riderId);
        const payload = {
            delivery,
            rider: riderDetails,
        };
        // Inform the specific customer that their delivery was accepted
        (0, socket_service_1.emitToRoom)(`customer-${delivery.customerId}`, "delivery_accepted", payload);
        res.status(200).json({
            success: true,
            message: "Delivery accepted successfully",
            delivery,
            rider: riderDetails,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.acceptDelivery = acceptDelivery;
/**
 * @desc    Customer cancels a delivery
 * @route   POST /api/v1/deliveries/:id/cancel
 * @access  Private (Customer)
 */
const cancelDelivery = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const customerId = (0, auth_middleware_1.getUserId)(req);
        if (!customerId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { id } = req.params;
        const delivery = yield delivery_model_1.default.findById(id);
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
        yield delivery.save();
        res.status(200).json({
            message: "Delivery cancelled successfully",
            delivery,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.cancelDelivery = cancelDelivery;
/**
 * @desc    Get current user's (customer) deliveries
 * @route   GET /api/v1/deliveries/my-deliveries
 * @access  Private (Customer)
 */
const getMyDeliveries = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const customerId = (0, auth_middleware_1.getUserId)(req);
        if (!customerId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        // Use a more robust query to handle potential type inconsistencies (String vs ObjectId)
        const query = {
            $or: [
                { customerId: customerId },
                { riderId: customerId },
            ]
        };
        // If it's a valid ObjectId hex string, also look for it as an actual ObjectId
        if (mongoose_1.default.Types.ObjectId.isValid(customerId)) {
            const objectId = new mongoose_1.default.Types.ObjectId(customerId);
            query.$or.push({ customerId: objectId });
            query.$or.push({ riderId: objectId });
        }
        const deliveries = yield delivery_model_1.default.find(query)
            .sort({ createdAt: -1 })
            .populate("riderId", "firstName lastName profileImageUrl riderStatus phoneNumber");
        const mobileDeliveries = deliveries.map((delivery) => ({
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
    }
    catch (error) {
        next(error);
    }
});
exports.getMyDeliveries = getMyDeliveries;
/**
 * @desc    Get a single delivery detail
 * @route   GET /api/v1/deliveries/:id
 * @access  Private (Customer/Rider)
 */
const getDeliveryById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // Find by ID, supporting both String and ObjectId types
        const query = { _id: id };
        if (mongoose_1.default.Types.ObjectId.isValid(id)) {
            query._id = { $in: [id, new mongoose_1.default.Types.ObjectId(id)] };
        }
        const delivery = yield delivery_model_1.default.findOne(query).populate("riderId", "firstName lastName profileImageUrl riderStatus phoneNumber");
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
                        id: delivery.riderId._id,
                        fullName: `${delivery.riderId.firstName} ${delivery.riderId.lastName}`,
                        profileImageUrl: delivery.riderId.profileImageUrl || null,
                        riderStatus: delivery.riderId.riderStatus || "incomplete",
                        phoneNumber: delivery.riderId.phoneNumber || "",
                    }
                    : null,
                customerId: delivery.customerId,
                createdAt: delivery.createdAt,
                updatedAt: delivery.updatedAt,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getDeliveryById = getDeliveryById;
