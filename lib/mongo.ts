// lib/mongo.ts
import mongoose from "mongoose";

let isConnected = false;

export async function connectDB() {
    if (isConnected) return;

    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");

    try {
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 20000,
        });
        isConnected = true;
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
        throw err;
    }
}

// export default mongoose so models can import the same instance
export default mongoose;
