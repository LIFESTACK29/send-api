import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import User from "../models/user.model";
import Wallet from "../models/wallet.model";

async function topup() {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log("Connected to MongoDB");

    const user = await User.findOne({ email: "alumandudaniel217@gmail.com" });
    if (!user) throw new Error("User not found: alumandudaniel217@gmail.com");

    const wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) throw new Error("Wallet not found for this user");

    const addKobo = 100_000 * 100; // ₦100,000 → kobo
    const before = wallet.balance;
    wallet.balance += addKobo;
    await wallet.save();

    console.log(`User:   ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`Before: ₦${(before / 100).toLocaleString()}`);
    console.log(`Added:  ₦100,000`);
    console.log(`After:  ₦${(wallet.balance / 100).toLocaleString()}`);

    await mongoose.disconnect();
    console.log("Done.");
}

topup().catch((e) => { console.error(e.message); process.exit(1); });
