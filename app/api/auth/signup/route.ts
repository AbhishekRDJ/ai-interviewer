import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import User from "../../../../app/models/User";
import { connectDB } from "@/lib/mongo";

export async function POST(req: Request) {
    try {
        const { name, email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        await connectDB();

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({ name, email, password: hashedPassword });

        return NextResponse.json({ message: "User created", user }, { status: 201 });
    } catch (error: any) {
        console.error("❌ Signup error:", error);
        return NextResponse.json(
            { error: error.message || "Signup failed" },
            { status: 500 }
        );
    }
}

