"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        await signIn("credentials", { email, password, callbackUrl: "/" });
    };

    return (
        <div className="flex justify-center items-center bg-gradient-to-br from-purple-100 via-white to-indigo-100 min-h-screen">
            <form
                onSubmit={handleLogin}
                className="space-y-5 bg-white shadow-lg hover:shadow-xl p-8 rounded-2xl w-full max-w-sm transition"
            >
                <h2 className="font-bold text-gray-800 text-2xl text-center">Login</h2>

                <div>
                    <label className="block mb-1 font-medium text-gray-700 text-sm">Email</label>
                    <input
                        type="email"
                        placeholder="example@email.com"
                        className="px-4 py-2 border border-gray-300 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full text-gray-800"
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block mb-1 font-medium text-gray-700 text-sm">Password</label>
                    <input
                        type="password"
                        placeholder="••••••••"
                        className="px-4 py-2 border border-gray-300 focus:border-indigo-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full text-gray-800"
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 shadow-md py-2 rounded-lg w-full font-semibold text-white hover:scale-[1.02] transition-transform"
                >
                    Login
                </button>
            </form>
        </div>
    );
}
