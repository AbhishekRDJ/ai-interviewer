// app/api/interviews/[id]/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo";
import { Session } from "../../../models/Session";
import mongoose from "mongoose";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        await connectDB();
        const doc = await Session.findById(params.id).lean();
        if (!doc) return new NextResponse(JSON.stringify({ error: "Not found" }), { status: 404 });
        // convert _id to string if needed
        return NextResponse.json(doc);
    } catch (err) {
        console.error(err);
        return new NextResponse(JSON.stringify({ error: String(err) }), { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    try {
        await connectDB();
        const payload = await req.json();
        const id = params.id;

        const updateOps: any = {};

        if (payload.appendResponse) {
            updateOps.$push = { responses: payload.appendResponse };
        }

        if (typeof payload.transcript === "string") {
            updateOps.$set = { transcript: payload.transcript };
        }

        if (payload.finalize) {
            updateOps.$set = Object.assign(updateOps.$set || {}, {
                status: "completed",
                completedAt: new Date(),
                transcript: payload.transcript || undefined,
            });
        }

        if (Object.keys(updateOps).length === 0) {
            return new NextResponse(JSON.stringify({ error: "No valid update provided" }), { status: 400 });
        }

        await Session.findByIdAndUpdate(id, updateOps, { new: true, upsert: false });
        const doc = await Session.findById(id).lean();
        return NextResponse.json(doc);
    } catch (err) {
        console.error("PATCH session error:", err);
        return new NextResponse(JSON.stringify({ error: String(err) }), { status: 500 });
    }
}
