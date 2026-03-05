import dotenv from "dotenv";
dotenv.config();

import app from "./src/app";
import connectDB from "./src/config/db";

const PORT: number = parseInt(process.env.PORT || "4250", 10);

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(
                `🚀 Server is running on port ${PORT} in ${app.get("env")} mode`,
            );
        });
    } catch (error) {
        console.log("❌ Failed to start the server:", error);
        process.exit(1);
    }
};

startServer();
