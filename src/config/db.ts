import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
    try {
        const conn = await mongoose.connect(
            process.env.MONGO_URI as string,
            {} as mongoose.ConnectOptions,
        );
    } catch (error) {
        process.exit(1);
    }
};

export default connectDB;
