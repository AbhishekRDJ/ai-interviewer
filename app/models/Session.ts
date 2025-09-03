// models/Session.ts
import mongoose from "@/lib/mongo";

const SessionSchema = new mongoose.Schema({
    roomUrl: { type: String, default: null },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    status: { type: String, default: "running" },
    transcript: { type: String, default: "" },
    responses: { type: Array, default: [] }, // array of Q&A objects
    metadata: { type: Object, default: {} },
    scoring: { type: Object, default: null },
}, { timestamps: true });

// Avoid OverwriteModelError during HMR
export const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);
export default Session;
