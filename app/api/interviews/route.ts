// app/api/interviews/route.ts
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo";
import { Session } from "../../models/Session";

export async function POST(req: Request) {
    try {
        await connectDB();

        const body = await req.json();
        const now = new Date();

        const doc = {
            roomUrl: body.roomUrl || null,
            startedAt: now,
            completedAt: null,
            status: "running",
            transcript: body.transcript || "",
            responses: body.responses || [],
            metadata: body.metadata || {},
        };

        const session = await Session.create(doc);

        return NextResponse.json({ id: session._id.toString(), ...doc });
    } catch (err) {
        console.error("Create session error:", err);
        return new NextResponse(JSON.stringify({ error: String(err) }), { status: 500 });
    }
}
