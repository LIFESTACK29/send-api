import mongoose from "mongoose";
import dotenv from "dotenv";
import Wallet from "../src/models/wallet.model";
import Transaction from "../src/models/transaction.model";

dotenv.config();

const clearDatabase = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log("Connected successfully.");

        console.log("Deleting all wallets...");
        const walletResult = await Wallet.deleteMany({});
        console.log(`Deleted ${walletResult.deletedCount} wallets.`);

        console.log("Deleting all transactions...");
        const txResult = await Transaction.deleteMany({});
        console.log(`Deleted ${txResult.deletedCount} transactions.`);

        console.log("Database cleared successfully.");
    } catch (error) {
        console.error("Error clearing database:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
    }
};

clearDatabase();
