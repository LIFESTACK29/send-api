import { Response, NextFunction } from "express";
import mongoose from "mongoose";
import Delivery from "../models/delivery.model";
import DeliveryMatchRequest from "../models/delivery-match-request.model";
import User from "../models/user.model";
import Vehicle from "../models/vehicle.model";
import { ensureWalletForUser } from "../services/wallet.service";
import { emitToRoom, emitToRiders } from "../services/socket.service";
import {
    addMatchRequestBroadcastJob,
    addMatchRequestTimeoutJob,
    addManualAssignmentCheckJob,
} from "../queues/delivery.queue";
import { AuthRequest } from "../types/user.type";
import { getUserId } from "../middlewares/auth.middleware";
import { uploadToStorage } from "../middlewares/upload.middleware";

const BASE_FEE_NAIRA = 1000;
const PER_KM_FEE_NAIRA = 200;
const MATCH_RADIUS_METERS = 5000;
const MATCH_TIMEOUT_SECONDS = 60;
const RIDER_HOME_HISTORY_LIMIT = 20;
const MATCH_LOOKBACK_MINUTES = 15;

const getDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
) => {
    const R = 6371;
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
        location.address ?? location.placeName ?? location.place_name ?? "",
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

const parseContactDetails = (
    rawDetails: any,
    label: "Customer" | "Receiver",
) => {
    let details = rawDetails;

    if (typeof details === "string") {
        try {
            details = JSON.parse(details);
        } catch {
            return {
                error: `${label} details payload format is invalid` as const,
            };
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

const createMobileDeliveryResponse = (
    delivery: any,
    nearbyRidersCount: number,
) => ({
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
        strategy:
            nearbyRidersCount > 0 ? "nearby_first" : "broadcast_all_online",
        nearbyRidersCount,
        radiusMeters: MATCH_RADIUS_METERS,
        timeoutSeconds: MATCH_TIMEOUT_SECONDS,
    },
    createdAt: delivery.createdAt,
});

const createMatchRequestResponse = (
    matchRequest: any,
    nearbyRidersCount: number,
) => ({
    id: matchRequest._id,
    status: matchRequest.status,
    pricing: {
        fee: matchRequest.fee,
        currency: "NGN",
    },
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
        strategy:
            nearbyRidersCount > 0 ? "nearby_first" : "broadcast_all_online",
        nearbyRidersCount,
        radiusMeters: matchRequest.searchRadiusMeters || MATCH_RADIUS_METERS,
        timeoutSeconds: matchRequest.timeoutSeconds || MATCH_TIMEOUT_SECONDS,
    },
    createdAt: matchRequest.createdAt,
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

const findNearbyActiveRiders = async (
    lat: number,
    lng: number,
    radius = MATCH_RADIUS_METERS,
) =>
    User.find({
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

const findAllActiveRiders = async (excludedRiderIds: string[] = []) =>
    User.find({
        role: "rider",
        isOnline: true,
        riderStatus: "active",
        ...(excludedRiderIds.length > 0
            ? { _id: { $nin: excludedRiderIds } }
            : {}),
    }).select("_id");

const emitMatchRequestToRiders = async (
    matchRequest: any,
    nearbyRiders: Array<{ _id: any }>,
    riderPayload: any,
) => {
    if (nearbyRiders.length > 0) {
        nearbyRiders.forEach((rider) => {
            emitToRoom(`user-${rider._id}`, "incoming_match_request", riderPayload);
        });
        return;
    }

    const excludedRiderIds = (matchRequest.declinedRiderIds || []).map((id: any) =>
        String(id),
    );
    const activeRiders = await findAllActiveRiders(excludedRiderIds);

    if (activeRiders.length === 0) return;

    activeRiders.forEach((rider) => {
        emitToRoom(`user-${rider._id}`, "incoming_match_request", riderPayload);
    });
};

const generateTrackingId = () =>
    `RS-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

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
            distance,
            fee,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Search riders first. Delivery is created only on rider accept or manual fallback.
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
                message:
                    "Package image is required. Please upload what you are sending.",
                code: "ITEM_IMAGE_REQUIRED",
            });
            return;
        }

        const distance = getDistance(
            pickupLocation.lat,
            pickupLocation.lng,
            dropoffLocation.lat,
            dropoffLocation.lng,
        );

        const calculatedFee = Math.ceil(
            BASE_FEE_NAIRA + distance * PER_KM_FEE_NAIRA,
        );
        const itemImage = await uploadToStorage(req.file, "deliveries");

        const matchRequest = await DeliveryMatchRequest.create({
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

        const nearbyRiders = await findNearbyActiveRiders(
            pickupLocation.lat,
            pickupLocation.lng,
            MATCH_RADIUS_METERS,
        );

        const riderPayload = createMatchRequestResponse(
            matchRequest,
            nearbyRiders.length,
        );
        await emitMatchRequestToRiders(matchRequest, nearbyRiders, riderPayload);

        await addMatchRequestBroadcastJob(matchRequest);
        await addMatchRequestTimeoutJob(matchRequest);

        res.status(201).json({
            success: true,
            message:
                "Rider search started. Delivery will be created after rider acceptance or manual fallback.",
            matchRequest: riderPayload,
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
                        "If no rider accepts within 60 seconds, create delivery manually for admin/worker assignment.",
                    endpoint: `/api/v1/deliveries/match-requests/${matchRequest._id}/create-manual`,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

export const waitMoreForRider = async (
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
        const matchRequest = await DeliveryMatchRequest.findOne({
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
        await matchRequest.save();

        const nearbyRiders = await findNearbyActiveRiders(
            matchRequest.pickupLocation.lat,
            matchRequest.pickupLocation.lng,
            matchRequest.searchRadiusMeters || MATCH_RADIUS_METERS,
        );

        const riderPayload = createMatchRequestResponse(
            matchRequest,
            nearbyRiders.length,
        );
        await emitMatchRequestToRiders(matchRequest, nearbyRiders, riderPayload);

        await addMatchRequestBroadcastJob(matchRequest);
        await addMatchRequestTimeoutJob(matchRequest);

        res.status(200).json({
            success: true,
            message: "Rider search resumed",
            matchRequest: riderPayload,
        });
    } catch (error) {
        next(error);
    }
};

export const createDeliveryManually = async (
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
        const matchRequest = await DeliveryMatchRequest.findOne({
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
            const existingDelivery = await Delivery.findById(
                matchRequest.createdDeliveryId,
            );
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
                message:
                    "This match request cannot be converted to manual delivery",
            });
            return;
        }

        const delivery = await Delivery.create({
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
        await matchRequest.save();

        const nearbyRiders = await findNearbyActiveRiders(
            delivery.pickupLocation.lat,
            delivery.pickupLocation.lng,
            MATCH_RADIUS_METERS,
        );

        if (nearbyRiders.length > 0) {
            nearbyRiders.forEach((rider) => {
                emitToRoom(`user-${rider._id}`, "incoming_delivery", delivery);
            });
        }

        await addManualAssignmentCheckJob(delivery, 0, 30000);

        res.status(201).json({
            success: true,
            message: "Manual delivery created and queued for assignment checks",
            delivery: createMobileDeliveryResponse(
                delivery,
                nearbyRiders.length,
            ),
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
    } catch (error) {
        next(error);
    }
};

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
 * Home payload for rider app:
 * - wallet balance
 * - recent ride history
 * - available nearby incoming ride requests
 */
export const getRiderHomeSummary = async (
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

        const rider = await User.findById(riderId).select(
            "currentLocation isOnline riderStatus",
        );
        if (!rider) {
            res.status(404).json({ message: "Rider not found" });
            return;
        }

        const [wallet, deliveries, openMatchRequests] = await Promise.all([
            ensureWalletForUser(riderId),
            Delivery.find({ riderId })
                .sort({ createdAt: -1 })
                .limit(RIDER_HOME_HISTORY_LIMIT),
            DeliveryMatchRequest.find({
                status: "SEARCHING",
                matchedRiderId: { $in: [null, undefined, ""] },
                declinedRiderIds: { $nin: [riderId] },
                createdAt: {
                    $gte: new Date(
                        Date.now() - MATCH_LOOKBACK_MINUTES * 60 * 1000,
                    ),
                },
            })
                .sort({ createdAt: -1 })
                .limit(40),
        ]);

        const riderLat = rider.currentLocation?.coordinates?.[1];
        const riderLng = rider.currentLocation?.coordinates?.[0];
        const incomingRequests =
            Number.isFinite(riderLat) && Number.isFinite(riderLng)
                ? openMatchRequests
                      .map((matchRequest) => {
                          const distanceKm = getDistance(
                              riderLat as number,
                              riderLng as number,
                              matchRequest.pickupLocation.lat,
                              matchRequest.pickupLocation.lng,
                          );
                          const distanceMeters = Math.round(distanceKm * 1000);
                          const allowedDistance =
                              matchRequest.searchRadiusMeters ||
                              MATCH_RADIUS_METERS;

                          if (distanceMeters > allowedDistance) return null;

                          return {
                              id: matchRequest._id,
                              status: matchRequest.status,
                              pricing: {
                                  fee: matchRequest.fee,
                                  feeInNaira: matchRequest.fee,
                                  currency: "NGN",
                              },
                              route: {
                                  distanceKm: Number(
                                      (matchRequest.distance || 0).toFixed(2),
                                  ),
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

        const rideHistory = deliveries.map((delivery: any) => ({
            id: delivery._id,
            trackingId: delivery.trackingId,
            status: delivery.status,
            pricing: {
                fee: delivery.fee,
                currency: "NGN",
            },
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
                    balance: wallet?.balance || 0,
                    balanceInNaira: (wallet?.balance || 0) / 100,
                    hasWallet: Boolean(wallet),
                },
                rider: {
                    isOnline: rider.isOnline,
                    riderStatus: rider.riderStatus,
                    hasLocation:
                        Number.isFinite(riderLat) && Number.isFinite(riderLng),
                    location:
                        Number.isFinite(riderLat) && Number.isFinite(riderLng)
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
    } catch (error) {
        next(error);
    }
};

export const declineMatchRequest = async (
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
        const { reason } = req.body || {};
        const matchRequest = await DeliveryMatchRequest.findById(id);

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

        const declined = new Set(
            (matchRequest.declinedRiderIds || []).map((value: any) =>
                String(value),
            ),
        );
        declined.add(String(riderId));
        matchRequest.declinedRiderIds = Array.from(declined);
        await matchRequest.save();

        emitToRoom(`customer-${matchRequest.customerId}`, "rider_declined_offer", {
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
    } catch (error) {
        next(error);
    }
};

/**
 * Accepts either a match request id (new flow) or a pending delivery id (manual/admin flow).
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

        const matchRequest = await DeliveryMatchRequest.findById(id);
        if (matchRequest) {
            if (
                !["SEARCHING", "NO_RIDER_FOUND"].includes(matchRequest.status)
            ) {
                res.status(400).json({
                    message: "Match request is no longer available",
                });
                return;
            }

            if (
                matchRequest.matchedRiderId &&
                String(matchRequest.matchedRiderId) !== String(riderId)
            ) {
                res.status(409).json({
                    message: "Another rider already accepted this request",
                });
                return;
            }

            if (matchRequest.createdDeliveryId) {
                const existingDelivery = await Delivery.findById(
                    matchRequest.createdDeliveryId,
                );
                if (existingDelivery) {
                    res.status(200).json({
                        success: true,
                        message:
                            "Delivery already created for this match request",
                        delivery: existingDelivery,
                    });
                    return;
                }
            }

            const delivery = await Delivery.create({
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
            await matchRequest.save();

            const riderDetails = await buildRiderPreview(riderId);
            const payload = {
                delivery,
                rider: riderDetails,
                matchRequestId: matchRequest._id,
            };

            emitToRiders("match_request_taken", {
                matchRequestId: matchRequest._id,
                acceptedByRiderId: riderId,
                deliveryId: delivery._id,
            });

            emitToRoom(
                `customer-${delivery.customerId}`,
                "delivery_accepted",
                payload,
            );

            res.status(200).json({
                success: true,
                message: "Match request accepted and delivery created",
                delivery,
                rider: riderDetails,
            });
            return;
        }

        const delivery = await Delivery.findById(id);
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
        await delivery.save();

        const riderDetails = await buildRiderPreview(riderId);
        const payload = { delivery, rider: riderDetails };

        emitToRoom(
            `customer-${delivery.customerId}`,
            "delivery_accepted",
            payload,
        );

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

export const assignRiderToDeliveryByAdmin = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        if (req.user?.role !== "admin") {
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

        const rider = await User.findById(riderId).select("role riderStatus");
        if (!rider || rider.role !== "rider") {
            res.status(404).json({
                success: false,
                message: "Rider not found",
            });
            return;
        }

        const delivery = await Delivery.findById(id);
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

        const riderDetails = await buildRiderPreview(riderId);
        const payload = {
            delivery,
            rider: riderDetails,
            assignedBy: "admin",
            requiresAcceptance: true,
            nextAction: {
                action: "accept_delivery",
                endpoint: `/api/v1/deliveries/${delivery._id}/accept`,
            },
        };

        emitToRoom(`user-${riderId}`, "assigned_delivery_offer", payload);
        emitToRoom(
            `customer-${delivery.customerId}`,
            "rider_assignment_offer_sent",
            {
                deliveryId: delivery._id,
                riderId,
                rider: riderDetails,
                message:
                    "A rider has been notified for your delivery. Assignment happens only after rider acceptance.",
            },
        );

        res.status(200).json({
            success: true,
            message:
                "Rider notified successfully. Delivery remains pending until rider accepts.",
            delivery,
            rider: riderDetails,
            state: "awaiting_rider_acceptance",
        });
    } catch (error) {
        next(error);
    }
};

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

        const query: any = {
            $or: [{ customerId: customerId }, { riderId: customerId }],
        };

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

        res.status(200).json({ success: true, deliveries: mobileDeliveries });
    } catch (error) {
        next(error);
    }
};

export const getDeliveryById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const { id } = req.params;

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
                              (delivery.riderId as any).riderStatus ||
                              "incomplete",
                          phoneNumber:
                              (delivery.riderId as any).phoneNumber || "",
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
