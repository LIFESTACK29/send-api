import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const cleanup = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI as string, {
            serverSelectionTimeoutMS: 5000,
        } as mongoose.ConnectOptions);

        console.log("✓ Connected to MongoDB");

        // Delete users with customer, rider, keke_rider roles
        const userResult = await mongoose
            .connection.collection("users")
            .deleteMany({
                role: { $in: ["customer", "rider", "keke_rider"] },
            });
        console.log(`✓ Deleted ${userResult.deletedCount} users`);

        // Clear Wallet collection
        const walletResult = await mongoose
            .connection.collection("wallets")
            .deleteMany({});
        console.log(`✓ Deleted ${walletResult.deletedCount} wallets`);

        // Clear Delivery collection
        const deliveryResult = await mongoose
            .connection.collection("deliveries")
            .deleteMany({});
        console.log(`✓ Deleted ${deliveryResult.deletedCount} deliveries`);

        // Clear Transaction collection
        const transactionResult = await mongoose
            .connection.collection("transactions")
            .deleteMany({});
        console.log(
            `✓ Deleted ${transactionResult.deletedCount} transactions`,
        );

        // Clear Ride collection
        const rideResult = await mongoose
            .connection.collection("rides")
            .deleteMany({});
        console.log(`✓ Deleted ${rideResult.deletedCount} rides`);

        console.log("\n✅ Database cleanup completed successfully!");
        console.log("You can now start onboarding from fresh.");

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("❌ Cleanup failed:", error);
        process.exit(1);
    }
};

cleanup();
