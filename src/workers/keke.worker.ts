import { Worker } from "bullmq";
import redisConnection from "../config/redis";
import Settlement from "../models/settlement.model";
import Ride from "../models/ride.model";
import Wallet from "../models/wallet.model";
import Transaction from "../models/transaction.model";
import { verifyTransfer } from "../services/paystack.service";
import { emitToRoom } from "../services/socket.service";

const processSettlement = async (
    settlement: any,
    paystackStatus: string,
    reason?: string,
) => {
    if (paystackStatus === "success") {
        if (settlement.status === "SETTLED") return;

        const session = await Settlement.startSession();
        session.startTransaction();
        try {
            const riderWallet = await Wallet.findOne({ userId: settlement.riderId }).session(session);
            const debitRef = `setl_payout_${settlement._id}_${Date.now()}`;

            await Transaction.create(
                [
                    {
                        userId: settlement.riderId,
                        type: "debit",
                        source: "settlement_payout",
                        amount: settlement.amount,
                        reference: debitRef,
                        status: "completed",
                        description: `Settlement payout (reconciled)`,
                        metadata: { settlementId: settlement._id },
                    },
                ],
                { session },
            );

            const balanceBefore = riderWallet?.balance ?? 0;
            await Wallet.findOneAndUpdate(
                { userId: settlement.riderId },
                { $inc: { balance: -settlement.amount } },
                { session },
            );

            await Settlement.findByIdAndUpdate(
                settlement._id,
                {
                    status: "SETTLED",
                    settledAt: new Date(),
                    walletBalanceAfterSettlement: Math.max(0, balanceBefore - settlement.amount),
                },
                { session },
            );

            await session.commitTransaction();
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }

        emitToRoom("ops_room", "settlement_status_update", {
            settlementId: settlement._id,
            status: "SETTLED",
            riderId: settlement.riderId,
        });
    } else if (paystackStatus === "failed" || paystackStatus === "reversed") {
        if (settlement.status === "FAILED" || settlement.status === "REVERSED") return;

        await Settlement.findByIdAndUpdate(settlement._id, {
            status: "FAILED",
            paystackFailureReason: reason ?? "Transfer failed",
        });

        // Release ride locks
        await Ride.updateMany(
            { _id: { $in: settlement.rideIds } },
            { settlementId: null },
        );

        emitToRoom("ops_room", "settlement_status_update", {
            settlementId: settlement._id,
            status: "FAILED",
            riderId: settlement.riderId,
            reason,
        });
    }
};

const kekeWorker = new Worker(
    "keke-reconciliation",
    async (job) => {
        if (job.data.type !== "SETTLEMENT_RECONCILIATION") return;

        console.log("[KekeWorker] Running settlement reconciliation");

        const now = new Date();
        const processingCutoff = new Date(now.getTime() - 5 * 60 * 1000);    // > 5 min ago
        const initiatedCutoff = new Date(now.getTime() - 2 * 60 * 1000);     // > 2 min ago

        // Settlements stuck in PROCESSING
        const processing = await Settlement.find({
            status: "PROCESSING",
            initiatedAt: { $lt: processingCutoff },
        });

        // Settlements stuck in INITIATED (Paystack call never completed)
        const initiated = await Settlement.find({
            status: "INITIATED",
            initiatedAt: { $lt: initiatedCutoff },
        });

        const toVerify = [...processing, ...initiated];
        console.log(`[KekeWorker] Verifying ${toVerify.length} settlement(s)`);

        for (const settlement of toVerify) {
            try {
                const resp = await verifyTransfer(settlement.paystackReference);
                const transferData = resp?.data;
                await processSettlement(
                    settlement,
                    transferData?.status,
                    transferData?.reason,
                );
            } catch (err: any) {
                console.error(
                    `[KekeWorker] Error verifying settlement ${settlement._id}:`,
                    err.message,
                );
            }
        }
    },
    { connection: redisConnection, concurrency: 1 },
);

kekeWorker.on("failed", (job, err) => {
    console.error(`[KekeWorker] Job ${job?.id} failed:`, err.message);
});

export const startKekeWorker = () => {
    console.log("[KekeWorker] Settlement reconciliation worker started");
    return kekeWorker;
};
