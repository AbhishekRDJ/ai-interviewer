"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        const data = await res.json();
        console.log(data);

        if (res.ok) {
            router.push("/"); // ✅ redirect after signup
        } else {
            alert(data.error || "Signup failed");
        }
    };

    return (
        <div className="flex justify-center items-center bg-gradient-to-br from-indigo-100 via-white to-purple-100 min-h-screen">
            <form
                onSubmit={handleSignup}
                className="space-y-5 bg-white shadow-lg hover:shadow-xl p-8 rounded-2xl w-full max-w-sm transition"
            >
                <h2 className="font-bold text-gray-800 text-2xl text-center">Sign Up</h2>

                <div>
                    <label className="block mb-1 font-medium text-gray-700 text-sm">Name</label>
                    <input
                        type="text"
                        placeholder="John Doe"
                        className="px-4 py-2 border border-gray-300 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full text-gray-800"
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block mb-1 font-medium text-gray-700 text-sm">Email</label>
                    <input
                        type="email"
                        placeholder="example@email.com"
                        className="px-4 py-2 border border-gray-300 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full text-gray-800"
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block mb-1 font-medium text-gray-700 text-sm">Password</label>
                    <input
                        type="password"
                        placeholder="••••••••"
                        className="px-4 py-2 border border-gray-300 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full text-gray-800"
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                </div>

                {/* Sign Up button */}
                <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 shadow-md py-2 rounded-lg w-full font-semibold text-white hover:scale-[1.02] transition-transform"
                >
                    Sign Up
                </button>

                {/* Login button */}
                <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className="bg-gray-200 hover:bg-gray-300 shadow-md py-2 rounded-lg w-full font-semibold text-gray-800 hover:scale-[1.02] transition-transform"
                >
                    Already have an account? Login
                </button>
            </form>
        </div>
    );
}
