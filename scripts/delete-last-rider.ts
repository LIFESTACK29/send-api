import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const deleteLastRider = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string, {
            serverSelectionTimeoutMS: 5000,
        } as mongoose.ConnectOptions);

        console.log("✓ Connected to MongoDB");

        // Find and delete the most recently created rider
        const deletedRider = await mongoose
            .connection.collection("users")
            .findOneAndDelete(
                { role: "rider" },
                { sort: { createdAt: -1 } }
            );

        if (deletedRider && deletedRider.value) {
            const rider = deletedRider.value;
            console.log(
                `✓ Deleted rider: ${rider.firstName} ${rider.lastName}`,
            );

            // Also delete associated vehicles and documents
            const vehicleResult = await mongoose
                .connection.collection("vehicles")
                .deleteMany({ userId: rider._id });
            console.log(
                `✓ Deleted ${vehicleResult.deletedCount} associated vehicles`,
            );

            const docResult = await mongoose
                .connection.collection("documents")
                .deleteMany({ userId: rider._id });
            console.log(
                `✓ Deleted ${docResult.deletedCount} associated documents`,
            );

            const walletResult = await mongoose
                .connection.collection("wallets")
                .deleteMany({ userId: rider._id });
            console.log(
                `✓ Deleted ${walletResult.deletedCount} associated wallets`,
            );
        } else {
            console.log("No rider found to delete");
        }

        console.log("\n✅ Cleanup completed!");
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
};

deleteLastRider();
