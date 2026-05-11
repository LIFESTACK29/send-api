import mongoose from "mongoose";
import Wallet from "../models/wallet.model";
import Transaction from "../models/transaction.model";

/**
 * Returns the portion of a user's wallet balance not locked by pending ride holds.
 * wallet.balance is not decremented until a ride completes, so we subtract
 * the sum of all pending RIDE_FARE_HOLD debits to get what's truly spendable.
 */
export const getAvailableBalance = async (
    userId: string | mongoose.Types.ObjectId,
): Promise<{ wallet: any; availableBalance: number }> => {
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) throw Object.assign(new Error("Wallet not found"), { code: "WALLET_NOT_FOUND" });

    const heldResult = await Transaction.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId.toString()),
                source: "ride_fare_hold",
                type: "debit",
                status: "pending",
            },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const totalHeld = heldResult[0]?.total ?? 0;
    const availableBalance = wallet.balance - totalHeld;

    return { wallet, availableBalance };
};

/**
 * Places a wallet hold for a ride. Creates a pending DEBIT transaction
 * without touching wallet.balance. Returns the hold transaction.
 */
export const placeRideHold = async (
    userId: string | mongoose.Types.ObjectId,
    rideId: mongoose.Types.ObjectId,
    fareKobo: number,
    session?: mongoose.ClientSession,
): Promise<any> => {
    const reference = `hold_${rideId}_${Date.now()}`;
    const [tx] = await Transaction.create(
        [
            {
                userId,
                rideId,
                type: "debit",
                source: "ride_fare_hold",
                amount: fareKobo,
                reference,
                status: "pending",
                description: `Ride fare hold`,
            },
        ],
        session ? { session } : {},
    );
    return tx;
};

/**
 * Cancels a pending hold — marks it cancelled without touching wallet.balance.
 */
export const cancelRideHold = async (
    holdId: mongoose.Types.ObjectId,
    session?: mongoose.ClientSession,
): Promise<void> => {
    await Transaction.findByIdAndUpdate(
        holdId,
        { status: "cancelled" },
        session ? { session } : {},
    );
};
