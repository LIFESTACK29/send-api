import mongoose from "mongoose";
import User from "./src/models/user.model";

const MONGODB_URI = "mongodb://127.0.0.1:27017/raha-send"; // Match .env

async function test() {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected");

    const clerkId = "user_3A71sKRRSTkbnABuZPr50lYbNyX";

    // Test 1: findOne
    const foundUser = await User.findOne({ clerkId });
    console.log("findOne result:", foundUser ? "FOUND" : "NOT FOUND");

    if (foundUser) {
        // Test 2: findOneAndUpdate
        try {
            const updatedUser = await User.findOneAndUpdate(
                { clerkId },
                { $push: { addresses: { name: "Test", location: "Loc" } } },
                { new: true, runValidators: true },
            );
            console.log(
                "findOneAndUpdate result:",
                updatedUser ? "FOUND" : "NOT FOUND (NULL returned)",
            );
        } catch (e: any) {
            console.error("findOneAndUpdate error:", e.message);
        }
    }

    process.exit(0);
}

test();
