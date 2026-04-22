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
const socket_service_1 = require("../services/socket.service");
const delivery_queue_1 = require("../queues/delivery.queue");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
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
/**
 * @desc    Calculate delivery fee based on coordinates
 * @route   POST /api/v1/deliveries/calculate-fee
 * @access  Private (Customer)
 */
const calculateDeliveryFee = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { pickupLocation, dropoffLocation } = req.body;
        if (!pickupLocation || !dropoffLocation) {
            res.status(400).json({ message: "Both locations are required" });
            return;
        }
        const distance = getDistance(pickupLocation.lat, pickupLocation.lng, dropoffLocation.lat, dropoffLocation.lng);
        // Fee = 1500 (base) + 200 per km
        const fee = Math.ceil(1000 + distance * 200);
        res.status(200).json({
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
        let { pickupLocation, dropoffLocation, packageType, deliveryNote, } = req.body;
        // Parse coordinates and objects if they're coming from FormData (strings)
        if (typeof pickupLocation === "string") {
            try {
                pickupLocation = JSON.parse(pickupLocation);
            }
            catch (e) {
                /* already an object or invalid */
            }
        }
        if (typeof dropoffLocation === "string") {
            try {
                dropoffLocation = JSON.parse(dropoffLocation);
            }
            catch (e) {
                /* already an object or invalid */
            }
        }
        // Calculate distance and fee
        const distance = getDistance(pickupLocation.lat, pickupLocation.lng, dropoffLocation.lat, dropoffLocation.lng);
        // Fee = 1500 (base) + 200 per km
        const calculatedFee = Math.ceil(1000 + distance * 200);
        // Handle image upload if exists
        let itemImage = "";
        if (req.file) {
            itemImage = yield (0, upload_middleware_1.uploadToStorage)(req.file, "deliveries");
        }
        // Generate a simple tracking ID
        const trackingId = `RS-${new Date()
            .toISOString()
            .split("T")[0]
            .replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
        const newDelivery = yield delivery_model_1.default.create({
            trackingId,
            pickupLocation,
            dropoffLocation,
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
            currentLocation: {
                $nearSphere: {
                    $geometry: {
                        type: "Point",
                        coordinates: [pickupLocation.lng, pickupLocation.lat], // [lng, lat]
                    },
                    $maxDistance: 5000, // 5km in meters
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
            message: "Delivery request created and matching started",
            delivery: newDelivery,
            nearbyRidersCount: nearbyRiders.length,
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
            currentLocation: {
                $nearSphere: {
                    $geometry: {
                        type: "Point",
                        coordinates: [Number(lng), Number(lat)],
                    },
                    $maxDistance: Number(radius),
                },
            },
        }).select("firstName lastName currentLocation");
        res.status(200).json({
            success: true,
            count: riders.length,
            riders,
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
        // Look up rider details from local DB
        let riderDetails = null;
        try {
            const riderUser = yield user_model_1.default.findById(riderId);
            if (riderUser) {
                riderDetails = {
                    id: riderId,
                    name: `${riderUser.firstName} ${riderUser.lastName}`,
                    rating: 4.9,
                    deliveries: 120,
                    vehicle: "Honda ACE 125 • Black",
                };
            }
        }
        catch (error) {
            console.error("Could not fetch rider details:", error);
        }
        const payload = {
            delivery,
            rider: riderDetails,
        };
        // Inform the specific customer that their delivery was accepted
        (0, socket_service_1.emitToRoom)(`customer-${delivery.customerId}`, "delivery_accepted", payload);
        res.status(200).json({
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
            .populate("riderId", "firstName lastName");
        res.status(200).json({
            success: true,
            deliveries,
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
        const delivery = yield delivery_model_1.default.findOne(query).populate("riderId", "firstName lastName");
        if (!delivery) {
            res.status(404).json({ message: "Delivery not found" });
            return;
        }
        res.status(200).json({
            success: true,
            delivery,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getDeliveryById = getDeliveryById;
