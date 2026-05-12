import mongoose from "mongoose";
import User from "../models/user.model";
import dotenv from "dotenv";
dotenv.config();

async function seedAdmin() {
    const dbUri = process.env.MONGO_URI;
    if (!dbUri) throw new Error("MONGO_URI not set");

    await mongoose.connect(dbUri);
    console.log("Connected to MongoDB");

    const email = "admin@send.ng";
    const existing = await User.findOne({ email });

    if (existing) {
        console.log(`Admin user already exists: ${email}`);
        await mongoose.disconnect();
        return;
    }

    await User.create({
        firstName: "Send",
        lastName: "Admin",
        email,
        phoneNumber: "08000000000",
        password: "Admin@1234",
        role: "admin",
        isOnboarded: true,
    });

    console.log("✓ Admin user created");
    console.log(`  Email:    ${email}`);
    console.log(`  Password: Admin@1234`);

    await mongoose.disconnect();
    console.log("Done.");
}

seedAdmin().catch((err) => {
    console.error(err);
    process.exit(1);
});
