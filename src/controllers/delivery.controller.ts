import { Request, Response, NextFunction } from "express";
import Delivery from "../models/delivery.model";
import { publishToChannel } from "../services/ably.service";
import { getClerkUserId } from "../middlewares/auth.middleware";
import { clerkClient } from "@clerk/clerk-sdk-node";

/**
 * @desc    Customer requests a new delivery
 * @route   POST /api/v1/deliveries/request
 * @access  Private (Customer)
 */
export const requestDelivery = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const customerId = getClerkUserId(req);
        if (!customerId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const {
            pickupLocation,
            dropoffLocation,
            packageType,
            deliveryNote,
            fee,
        } = req.body;

        // Generate a simple tracking ID
        const trackingId = `RS-${new Date()
            .toISOString()
            .split("T")[0]
            .replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newDelivery = await Delivery.create({
            trackingId,
            pickupLocation,
            dropoffLocation,
            packageType,
            deliveryNote,
            fee: fee || 3900,
            status: "PENDING",
            customerId,
        });

        // Publish to the riders-pool so all available riders are notified instantly
        await publishToChannel("riders-pool", "incoming_delivery", newDelivery);

        res.status(201).json({
            message: "Delivery request created and broadcasted to riders",
            delivery: newDelivery,
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
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const riderId = getClerkUserId(req);
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

        let riderDetails = null;
        try {
            const riderUser = await clerkClient.users.getUser(riderId);
            riderDetails = {
                id: riderId,
                name:
                    riderUser.firstName && riderUser.lastName
                        ? `${riderUser.firstName} ${riderUser.lastName}`
                        : riderUser.firstName || "Rider",
                imageUrl: riderUser.imageUrl,
                rating: 4.9,
                deliveries: 120,
                vehicle: "Honda ACE 125 • Black",
            };
        } catch (error) {
            console.error("Could not fetch rider from clerk", error);
        }

        const payload = {
            delivery,
            rider: riderDetails,
        };

        // Inform the specific customer that their delivery was accepted
        await publishToChannel(
            `customer-${delivery.customerId}`,
            "delivery_accepted",
            payload,
        );

        res.status(200).json({
            message: "Delivery accepted successfully",
            delivery,
            rider: riderDetails,
        });
    } catch (error) {
        next(error);
    }
};
