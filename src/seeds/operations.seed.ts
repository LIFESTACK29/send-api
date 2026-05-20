import mongoose from "mongoose";
import User from "../models/user.model";
import dotenv from "dotenv";
dotenv.config();

async function seedOperations() {
    const dbUri = process.env.MONGO_URI;
    if (!dbUri) throw new Error("MONGO_URI not set");

    await mongoose.connect(dbUri);
    console.log("Connected to MongoDB");

    const email = "ops@send.ng";
    const existing = await User.findOne({ email });

    if (existing) {
        console.log(`Operations user already exists: ${email}`);
        await mongoose.disconnect();
        return;
    }

    await User.create({
        firstName: "Send",
        lastName: "Operations",
        email,
        phoneNumber: "08000000001",
        password: "Ops@1234",
        role: "operations",
        isOnboarded: true,
    });

    console.log("✓ Operations user created");
    console.log(`  Email:    ${email}`);
    console.log(`  Password: Ops@1234`);

    await mongoose.disconnect();
    console.log("Done.");
}

seedOperations().catch((err) => {
    console.error(err);
    process.exit(1);
});
