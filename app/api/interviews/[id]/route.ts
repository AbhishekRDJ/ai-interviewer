// app/api/interviews/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../lib/mongo";
import { Session } from "../../../models/Session";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();
        const { id } = await context.params;

        const session = await Session.findById(id);
        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        return NextResponse.json(session);
    } catch (error: unknown) {
        console.error("Error fetching session:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();

        const payload = await req.json();
        const { id } = await context.params;

        const updateOps: Record<string, unknown> = {};

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
            return NextResponse.json(
                { error: "No valid update provided" },
                { status: 400 }
            );
        }

        await Session.findByIdAndUpdate(id, updateOps, { new: true, upsert: false });
        const doc = await Session.findById(id);
        return NextResponse.json(doc);
    } catch (err) {
        console.error("PATCH session error:", err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
