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
exports.getDeliveryById = exports.getMyDeliveries = exports.cancelDelivery = exports.assignRiderToDeliveryByAdmin = exports.acceptDelivery = exports.declineMatchRequest = exports.getRiderHomeSummary = exports.getNearbyRiders = exports.createDeliveryManually = exports.waitMoreForRider = exports.requestDelivery = exports.calculateDeliveryFee = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const delivery_model_1 = __importDefault(require("../models/delivery.model"));
const delivery_match_request_model_1 = __importDefault(require("../models/delivery-match-request.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const vehicle_model_1 = __importDefault(require("../models/vehicle.model"));
const wallet_service_1 = require("../services/wallet.service");
const socket_service_1 = require("../services/socket.service");
const delivery_queue_1 = require("../queues/delivery.queue");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const BASE_FEE_NAIRA = 1000;
const PER_KM_FEE_NAIRA = 200;
const MATCH_RADIUS_METERS = 5000;
const MATCH_TIMEOUT_SECONDS = 60;
const RIDER_HOME_HISTORY_LIMIT = 20;
const MATCH_LOOKBACK_MINUTES = 15;
const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
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
            return {
                error: `${label} details payload format is invalid`,
            };
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
const getPricingBreakdown = (distance, totalFareOverride) => {
    const distanceFare = Math.ceil(distance * PER_KM_FEE_NAIRA);
    const totalFare = totalFareOverride !== undefined
        ? totalFareOverride
        : Math.ceil(BASE_FEE_NAIRA + distanceFare);
    return {
        baseFare: BASE_FEE_NAIRA,
        distanceFare,
        totalFare,
    };
};
const buildPricingForViewer = (distance, viewer, totalFareOverride) => {
    const breakdown = getPricingBreakdown(distance, totalFareOverride);
    if (viewer === "rider") {
        return {
            fee: breakdown.distanceFare,
            distanceFare: breakdown.distanceFare,
            currency: "NGN",
        };
    }
    return {
        fee: breakdown.totalFare,
        totalFare: breakdown.totalFare,
        currency: "NGN",
    };
};
const createMobileDeliveryResponse = (delivery, nearbyRidersCount, viewer = "customer") => ({
    id: delivery._id,
    trackingId: delivery.trackingId,
    status: delivery.status,
    pricing: buildPricingForViewer(delivery.distance || 0, viewer, delivery.fee),
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
const createMatchRequestResponse = (matchRequest, nearbyRidersCount, viewer = "customer") => ({
    id: matchRequest._id,
    status: matchRequest.status,
    pricing: buildPricingForViewer(matchRequest.distance || 0, viewer, matchRequest.fee),
    route: {
        distanceKm: Number((matchRequest.distance || 0).toFixed(2)),
        pickup: matchRequest.pickupLocation,
        dropoff: matchRequest.dropoffLocation,
    },
    contact: {
        customer: matchRequest.customer,
        receiver: matchRequest.receiver,
    },
    package: {
        type: matchRequest.packageType,
        note: matchRequest.deliveryNote || "",
        imageUrl: matchRequest.itemImage || null,
    },
    matching: {
        strategy: nearbyRidersCount > 0 ? "nearby_first" : "broadcast_all_online",
        nearbyRidersCount,
        radiusMeters: matchRequest.searchRadiusMeters || MATCH_RADIUS_METERS,
        timeoutSeconds: matchRequest.timeoutSeconds || MATCH_TIMEOUT_SECONDS,
    },
    createdAt: matchRequest.createdAt,
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
const findNearbyActiveRiders = (lat_1, lng_1, ...args_1) => __awaiter(void 0, [lat_1, lng_1, ...args_1], void 0, function* (lat, lng, radius = MATCH_RADIUS_METERS) {
    return user_model_1.default.find({
        role: "rider",
        isOnline: true,
        riderStatus: "active",
        currentLocation: {
            $nearSphere: {
                $geometry: {
                    type: "Point",
                    coordinates: [lng, lat],
                },
                $maxDistance: radius,
            },
        },
    }).select("_id");
});
const findAllActiveRiders = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (excludedRiderIds = []) {
    return user_model_1.default.find(Object.assign({ role: "rider", isOnline: true, riderStatus: "active" }, (excludedRiderIds.length > 0
        ? { _id: { $nin: excludedRiderIds } }
        : {}))).select("_id");
});
const emitMatchRequestToRiders = (matchRequest, nearbyRiders, riderPayload) => __awaiter(void 0, void 0, void 0, function* () {
    if (nearbyRiders.length > 0) {
        nearbyRiders.forEach((rider) => {
            (0, socket_service_1.emitToRoom)(`user-${rider._id}`, "incoming_match_request", riderPayload);
        });
        return;
    }
    const excludedRiderIds = (matchRequest.declinedRiderIds || []).map((id) => String(id));
    const activeRiders = yield findAllActiveRiders(excludedRiderIds);
    if (activeRiders.length === 0)
        return;
    activeRiders.forEach((rider) => {
        (0, socket_service_1.emitToRoom)(`user-${rider._id}`, "incoming_match_request", riderPayload);
    });
});
const generateTrackingId = () => `RS-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
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
 * Search riders first. Delivery is created only on rider accept or manual fallback.
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
        const distance = getDistance(pickupLocation.lat, pickupLocation.lng, dropoffLocation.lat, dropoffLocation.lng);
        const calculatedFee = Math.ceil(BASE_FEE_NAIRA + distance * PER_KM_FEE_NAIRA);
        const itemImage = yield (0, upload_middleware_1.uploadToStorage)(req.file, "deliveries");
        const matchRequest = yield delivery_match_request_model_1.default.create({
            customerId,
            pickupLocation,
            dropoffLocation,
            customer: customerParsed.value,
            receiver: receiverParsed.value,
            packageType,
            deliveryNote,
            itemImage,
            distance,
            fee: calculatedFee,
            status: "SEARCHING",
            searchRadiusMeters: MATCH_RADIUS_METERS,
            timeoutSeconds: MATCH_TIMEOUT_SECONDS,
        });
        const nearbyRiders = yield findNearbyActiveRiders(pickupLocation.lat, pickupLocation.lng, MATCH_RADIUS_METERS);
        const riderPayload = createMatchRequestResponse(matchRequest, nearbyRiders.length, "rider");
        const customerPayload = createMatchRequestResponse(matchRequest, nearbyRiders.length, "customer");
        yield emitMatchRequestToRiders(matchRequest, nearbyRiders, riderPayload);
        yield (0, delivery_queue_1.addMatchRequestBroadcastJob)(matchRequest);
        yield (0, delivery_queue_1.addMatchRequestTimeoutJob)(matchRequest);
        res.status(201).json({
            success: true,
            message: "Rider search started. Delivery will be created after rider acceptance or manual fallback.",
            matchRequest: customerPayload,
            nextAction: {
                state: "searching_for_rider",
                socketEvents: {
                    onAccepted: "delivery_accepted",
                    onNoRiderFound: "no_rider_found",
                },
                fallback: {
                    type: "create_it_yourself",
                    label: "Create It Yourself",
                    description: "If no rider accepts within 60 seconds, create delivery manually for admin/worker assignment.",
                    endpoint: `/api/v1/deliveries/match-requests/${matchRequest._id}/create-manual`,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.requestDelivery = requestDelivery;
const waitMoreForRider = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const customerId = (0, auth_middleware_1.getUserId)(req);
        if (!customerId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { id } = req.params;
        const matchRequest = yield delivery_match_request_model_1.default.findOne({
            _id: id,
            customerId,
        });
        if (!matchRequest) {
            res.status(404).json({
                success: false,
                message: "Match request not found",
            });
            return;
        }
        if (!["NO_RIDER_FOUND", "SEARCHING"].includes(matchRequest.status)) {
            res.status(400).json({
                success: false,
                message: "Match request is no longer in a searchable state",
            });
            return;
        }
        matchRequest.status = "SEARCHING";
        yield matchRequest.save();
        const nearbyRiders = yield findNearbyActiveRiders(matchRequest.pickupLocation.lat, matchRequest.pickupLocation.lng, matchRequest.searchRadiusMeters || MATCH_RADIUS_METERS);
        const riderPayload = createMatchRequestResponse(matchRequest, nearbyRiders.length, "rider");
        const customerPayload = createMatchRequestResponse(matchRequest, nearbyRiders.length, "customer");
        yield emitMatchRequestToRiders(matchRequest, nearbyRiders, riderPayload);
        yield (0, delivery_queue_1.addMatchRequestBroadcastJob)(matchRequest);
        yield (0, delivery_queue_1.addMatchRequestTimeoutJob)(matchRequest);
        res.status(200).json({
            success: true,
            message: "Rider search resumed",
            matchRequest: customerPayload,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.waitMoreForRider = waitMoreForRider;
const createDeliveryManually = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const customerId = (0, auth_middleware_1.getUserId)(req);
        if (!customerId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { id } = req.params;
        const matchRequest = yield delivery_match_request_model_1.default.findOne({
            _id: id,
            customerId,
        });
        if (!matchRequest) {
            res.status(404).json({
                success: false,
                message: "Match request not found",
            });
            return;
        }
        if (matchRequest.createdDeliveryId) {
            const existingDelivery = yield delivery_model_1.default.findById(matchRequest.createdDeliveryId);
            if (existingDelivery) {
                res.status(200).json({
                    success: true,
                    message: "Manual delivery already created",
                    delivery: createMobileDeliveryResponse(existingDelivery, 0),
                });
                return;
            }
        }
        if (["RIDER_ASSIGNED", "CANCELLED"].includes(matchRequest.status)) {
            res.status(400).json({
                success: false,
                message: "This match request cannot be converted to manual delivery",
            });
            return;
        }
        const delivery = yield delivery_model_1.default.create({
            trackingId: generateTrackingId(),
            pickupLocation: matchRequest.pickupLocation,
            dropoffLocation: matchRequest.dropoffLocation,
            customer: matchRequest.customer,
            receiver: matchRequest.receiver,
            packageType: matchRequest.packageType,
            deliveryNote: matchRequest.deliveryNote,
            itemImage: matchRequest.itemImage,
            distance: matchRequest.distance,
            fee: matchRequest.fee,
            status: "PENDING",
            customerId: matchRequest.customerId,
        });
        matchRequest.status = "MANUAL_CREATED";
        matchRequest.createdDeliveryId = String(delivery._id);
        yield matchRequest.save();
        const nearbyRiders = yield findNearbyActiveRiders(delivery.pickupLocation.lat, delivery.pickupLocation.lng, MATCH_RADIUS_METERS);
        if (nearbyRiders.length > 0) {
            const riderDeliveryPayload = createMobileDeliveryResponse(delivery, nearbyRiders.length, "rider");
            nearbyRiders.forEach((rider) => {
                (0, socket_service_1.emitToRoom)(`user-${rider._id}`, "incoming_delivery", riderDeliveryPayload);
            });
        }
        yield (0, delivery_queue_1.addManualAssignmentCheckJob)(delivery, 0, 30000);
        res.status(201).json({
            success: true,
            message: "Manual delivery created and queued for assignment checks",
            delivery: createMobileDeliveryResponse(delivery, nearbyRiders.length),
            assignment: {
                mode: "worker_or_admin",
                state: "pending_assignment",
                socketEvents: {
                    onRiderAssigned: "delivery_accepted",
                    onRidersNearby: "manual_delivery_riders_available",
                    onAdminOfferSent: "rider_assignment_offer_sent",
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createDeliveryManually = createDeliveryManually;
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
 * Home payload for rider app:
 * - wallet balance
 * - recent ride history
 * - available nearby incoming ride requests
 */
const getRiderHomeSummary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const riderId = (0, auth_middleware_1.getUserId)(req);
        if (!riderId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const rider = yield user_model_1.default.findById(riderId).select("currentLocation isOnline riderStatus");
        if (!rider) {
            res.status(404).json({ message: "Rider not found" });
            return;
        }
        const [wallet, deliveries, openMatchRequests] = yield Promise.all([
            (0, wallet_service_1.ensureWalletForUser)(riderId),
            delivery_model_1.default.find({ riderId })
                .sort({ createdAt: -1 })
                .limit(RIDER_HOME_HISTORY_LIMIT),
            delivery_match_request_model_1.default.find({
                status: "SEARCHING",
                matchedRiderId: { $in: [null, undefined, ""] },
                declinedRiderIds: { $nin: [riderId] },
                createdAt: {
                    $gte: new Date(Date.now() - MATCH_LOOKBACK_MINUTES * 60 * 1000),
                },
            })
                .sort({ createdAt: -1 })
                .limit(40),
        ]);
        const riderLat = (_b = (_a = rider.currentLocation) === null || _a === void 0 ? void 0 : _a.coordinates) === null || _b === void 0 ? void 0 : _b[1];
        const riderLng = (_d = (_c = rider.currentLocation) === null || _c === void 0 ? void 0 : _c.coordinates) === null || _d === void 0 ? void 0 : _d[0];
        const incomingRequests = Number.isFinite(riderLat) && Number.isFinite(riderLng)
            ? openMatchRequests
                .map((matchRequest) => {
                const distanceKm = getDistance(riderLat, riderLng, matchRequest.pickupLocation.lat, matchRequest.pickupLocation.lng);
                const distanceMeters = Math.round(distanceKm * 1000);
                const allowedDistance = matchRequest.searchRadiusMeters ||
                    MATCH_RADIUS_METERS;
                if (distanceMeters > allowedDistance)
                    return null;
                return {
                    id: matchRequest._id,
                    status: matchRequest.status,
                    pricing: buildPricingForViewer(matchRequest.distance || 0, "rider", matchRequest.fee),
                    route: {
                        distanceKm: Number((matchRequest.distance || 0).toFixed(2)),
                        riderDistanceMeters: distanceMeters,
                        pickup: matchRequest.pickupLocation,
                        dropoff: matchRequest.dropoffLocation,
                    },
                    contact: {
                        customer: matchRequest.customer,
                        receiver: matchRequest.receiver,
                    },
                    package: {
                        type: matchRequest.packageType,
                        note: matchRequest.deliveryNote || "",
                        imageUrl: matchRequest.itemImage || null,
                    },
                    actions: {
                        acceptEndpoint: `/api/v1/deliveries/${matchRequest._id}/accept`,
                        declineEndpoint: `/api/v1/deliveries/match-requests/${matchRequest._id}/decline`,
                    },
                    createdAt: matchRequest.createdAt,
                };
            })
                .filter(Boolean)
            : [];
        const rideHistory = deliveries.map((delivery) => ({
            id: delivery._id,
            trackingId: delivery.trackingId,
            status: delivery.status,
            pricing: buildPricingForViewer(delivery.distance || 0, "rider", delivery.fee),
            route: {
                pickup: delivery.pickupLocation,
                dropoff: delivery.dropoffLocation,
                distanceKm: Number((delivery.distance || 0).toFixed(2)),
            },
            createdAt: delivery.createdAt,
            updatedAt: delivery.updatedAt,
        }));
        res.status(200).json({
            success: true,
            data: {
                wallet: {
                    balance: (wallet === null || wallet === void 0 ? void 0 : wallet.balance) || 0,
                    balanceInNaira: ((wallet === null || wallet === void 0 ? void 0 : wallet.balance) || 0) / 100,
                    hasWallet: Boolean(wallet),
                },
                rider: {
                    isOnline: rider.isOnline,
                    riderStatus: rider.riderStatus,
                    hasLocation: Number.isFinite(riderLat) && Number.isFinite(riderLng),
                    location: Number.isFinite(riderLat) && Number.isFinite(riderLng)
                        ? { lat: riderLat, lng: riderLng }
                        : null,
                },
                incomingRideRequests: incomingRequests,
                rideHistory,
                sockets: {
                    channel: `user-${riderId}`,
                    events: {
                        incomingRide: "incoming_match_request",
                        acceptedByOtherRider: "match_request_taken",
                    },
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getRiderHomeSummary = getRiderHomeSummary;
const declineMatchRequest = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const riderId = (0, auth_middleware_1.getUserId)(req);
        if (!riderId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { id } = req.params;
        const { reason } = req.body || {};
        const matchRequest = yield delivery_match_request_model_1.default.findById(id);
        if (!matchRequest) {
            res.status(404).json({
                success: false,
                message: "Match request not found",
            });
            return;
        }
        if (!["SEARCHING", "NO_RIDER_FOUND"].includes(matchRequest.status)) {
            res.status(400).json({
                success: false,
                message: "Match request is no longer available",
            });
            return;
        }
        const declined = new Set((matchRequest.declinedRiderIds || []).map((value) => String(value)));
        declined.add(String(riderId));
        matchRequest.declinedRiderIds = Array.from(declined);
        yield matchRequest.save();
        (0, socket_service_1.emitToRoom)(`customer-${matchRequest.customerId}`, "rider_declined_offer", {
            matchRequestId: matchRequest._id,
            riderId,
            reason: reason || null,
        });
        res.status(200).json({
            success: true,
            message: "Ride declined successfully",
            data: {
                matchRequestId: matchRequest._id,
                riderId,
                status: matchRequest.status,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.declineMatchRequest = declineMatchRequest;
/**
 * Accepts either a match request id (new flow) or a pending delivery id (manual/admin flow).
 */
const acceptDelivery = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const riderId = (0, auth_middleware_1.getUserId)(req);
        if (!riderId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const { id } = req.params;
        const matchRequest = yield delivery_match_request_model_1.default.findById(id);
        if (matchRequest) {
            if (!["SEARCHING", "NO_RIDER_FOUND"].includes(matchRequest.status)) {
                res.status(400).json({
                    message: "Match request is no longer available",
                });
                return;
            }
            if (matchRequest.matchedRiderId &&
                String(matchRequest.matchedRiderId) !== String(riderId)) {
                res.status(409).json({
                    message: "Another rider already accepted this request",
                });
                return;
            }
            if (matchRequest.createdDeliveryId) {
                const existingDelivery = yield delivery_model_1.default.findById(matchRequest.createdDeliveryId);
                if (existingDelivery) {
                    res.status(200).json({
                        success: true,
                        message: "Delivery already created for this match request",
                        delivery: createMobileDeliveryResponse(existingDelivery, 0, "rider"),
                    });
                    return;
                }
            }
            const delivery = yield delivery_model_1.default.create({
                trackingId: generateTrackingId(),
                pickupLocation: matchRequest.pickupLocation,
                dropoffLocation: matchRequest.dropoffLocation,
                customer: matchRequest.customer,
                receiver: matchRequest.receiver,
                packageType: matchRequest.packageType,
                deliveryNote: matchRequest.deliveryNote,
                itemImage: matchRequest.itemImage,
                distance: matchRequest.distance,
                fee: matchRequest.fee,
                status: "ONGOING",
                customerId: matchRequest.customerId,
                riderId,
            });
            matchRequest.status = "RIDER_ASSIGNED";
            matchRequest.matchedRiderId = riderId;
            matchRequest.createdDeliveryId = String(delivery._id);
            yield matchRequest.save();
            const riderDetails = yield buildRiderPreview(riderId);
            const customerDeliveryPayload = createMobileDeliveryResponse(delivery, 0, "customer");
            const payload = {
                delivery: customerDeliveryPayload,
                rider: riderDetails,
                matchRequestId: matchRequest._id,
            };
            (0, socket_service_1.emitToRiders)("match_request_taken", {
                matchRequestId: matchRequest._id,
                acceptedByRiderId: riderId,
                deliveryId: delivery._id,
            });
            (0, socket_service_1.emitToRoom)(`customer-${delivery.customerId}`, "delivery_accepted", payload);
            res.status(200).json({
                success: true,
                message: "Match request accepted and delivery created",
                delivery: createMobileDeliveryResponse(delivery, 0, "rider"),
                rider: riderDetails,
            });
            return;
        }
        const delivery = yield delivery_model_1.default.findById(id);
        if (!delivery) {
            res.status(404).json({
                message: "Delivery or match request not found",
            });
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
            delivery: createMobileDeliveryResponse(delivery, 0, "customer"),
            rider: riderDetails,
        };
        (0, socket_service_1.emitToRoom)(`customer-${delivery.customerId}`, "delivery_accepted", payload);
        res.status(200).json({
            success: true,
            message: "Delivery accepted successfully",
            delivery: createMobileDeliveryResponse(delivery, 0, "rider"),
            rider: riderDetails,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.acceptDelivery = acceptDelivery;
const assignRiderToDeliveryByAdmin = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== "admin") {
            res.status(403).json({
                success: false,
                message: "Forbidden - admin only",
            });
            return;
        }
        const { id } = req.params;
        const { riderId } = req.body;
        if (!riderId) {
            res.status(400).json({
                success: false,
                message: "riderId is required",
            });
            return;
        }
        const rider = yield user_model_1.default.findById(riderId).select("role riderStatus");
        if (!rider || rider.role !== "rider") {
            res.status(404).json({
                success: false,
                message: "Rider not found",
            });
            return;
        }
        const delivery = yield delivery_model_1.default.findById(id);
        if (!delivery) {
            res.status(404).json({
                success: false,
                message: "Delivery not found",
            });
            return;
        }
        if (delivery.status !== "PENDING") {
            res.status(400).json({
                success: false,
                message: "Only pending deliveries can receive rider offers",
            });
            return;
        }
        const riderDetails = yield buildRiderPreview(riderId);
        const payload = {
            delivery: createMobileDeliveryResponse(delivery, 0, "rider"),
            rider: riderDetails,
            assignedBy: "admin",
            requiresAcceptance: true,
            nextAction: {
                action: "accept_delivery",
                endpoint: `/api/v1/deliveries/${delivery._id}/accept`,
            },
        };
        (0, socket_service_1.emitToRoom)(`user-${riderId}`, "assigned_delivery_offer", payload);
        (0, socket_service_1.emitToRoom)(`customer-${delivery.customerId}`, "rider_assignment_offer_sent", {
            deliveryId: delivery._id,
            riderId,
            rider: riderDetails,
            message: "A rider has been notified for your delivery. Assignment happens only after rider acceptance.",
        });
        res.status(200).json({
            success: true,
            message: "Rider notified successfully. Delivery remains pending until rider accepts.",
            delivery,
            rider: riderDetails,
            state: "awaiting_rider_acceptance",
        });
    }
    catch (error) {
        next(error);
    }
});
exports.assignRiderToDeliveryByAdmin = assignRiderToDeliveryByAdmin;
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
const getMyDeliveries = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const customerId = (0, auth_middleware_1.getUserId)(req);
        const viewer = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === "rider" ? "rider" : "customer";
        if (!customerId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const query = {
            $or: [{ customerId: customerId }, { riderId: customerId }],
        };
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
            pricing: buildPricingForViewer(delivery.distance || 0, viewer, delivery.fee),
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
        res.status(200).json({ success: true, deliveries: mobileDeliveries });
    }
    catch (error) {
        next(error);
    }
});
exports.getMyDeliveries = getMyDeliveries;
const getDeliveryById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const viewer = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === "rider" ? "rider" : "customer";
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
                pricing: buildPricingForViewer(delivery.distance || 0, viewer, delivery.fee),
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
                        riderStatus: delivery.riderId.riderStatus ||
                            "incomplete",
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
