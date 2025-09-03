"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Mail, Lock, Brain, ArrowRight } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await signIn("credentials", {
                email,
                password,
                callbackUrl: "/"
            });
        } catch (error) {
            console.error("Login failed:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex justify-center items-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 min-h-screen overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="-top-40 -right-40 absolute bg-purple-500 opacity-20 blur-xl rounded-full w-80 h-80 animate-blob mix-blend-multiply filter"></div>
                <div className="-bottom-40 -left-40 absolute bg-blue-500 opacity-20 blur-xl rounded-full w-80 h-80 animate-blob animation-delay-2000 mix-blend-multiply filter"></div>
                <div className="top-40 left-40 absolute bg-pink-500 opacity-20 blur-xl rounded-full w-80 h-80 animate-blob animation-delay-4000 mix-blend-multiply filter"></div>
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo/Brand section */}
                <div className="mb-8 text-center">
                    <div className="inline-flex justify-center items-center bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg mb-4 rounded-2xl w-16 h-16">
                        <Brain className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="bg-clip-text bg-gradient-to-r from-white to-purple-200 font-bold text-transparent text-3xl">
                        AI Interview Pro
                    </h1>
                    <p className="mt-2 text-purple-200 text-sm">Ace your next interview with AI</p>
                </div>

                {/* Login Form */}
                <div className="bg-white/10 shadow-2xl backdrop-blur-lg p-8 border border-white/20 rounded-3xl">
                    <div className="mb-6 text-center">
                        <h2 className="mb-2 font-bold text-white text-2xl">Welcome Back</h2>
                        <p className="text-purple-200 text-sm">Sign in to continue your journey</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="block font-medium text-purple-200 text-sm">Email Address</label>
                            <div className="group relative">
                                <Mail className="top-1/2 left-3 absolute w-5 h-5 text-purple-400 group-focus-within:text-purple-300 transition-colors -translate-y-1/2 transform" />
                                <input
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-white/5 backdrop-blur-sm py-3 pr-4 pl-12 border border-white/20 focus:border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 w-full text-white transition-all duration-200 placeholder-purple-300"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label className="block font-medium text-purple-200 text-sm">Password</label>
                            <div className="group relative">
                                <Lock className="top-1/2 left-3 absolute w-5 h-5 text-purple-400 group-focus-within:text-purple-300 transition-colors -translate-y-1/2 transform" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-white/5 backdrop-blur-sm py-3 pr-12 pl-12 border border-white/20 focus:border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 w-full text-white transition-all duration-200 placeholder-purple-300"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="top-1/2 right-3 absolute text-purple-400 hover:text-purple-300 transition-colors -translate-y-1/2 transform"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Forgot Password */}
                        <div className="text-right">
                            <button
                                type="button"
                                className="text-purple-300 hover:text-white text-sm transition-colors"
                            >
                                Forgot password?
                            </button>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex justify-center items-center gap-2 bg-gradient-to-r from-purple-600 hover:from-purple-700 to-blue-600 hover:to-blue-700 disabled:opacity-50 px-6 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent w-full font-semibold text-white hover:scale-[1.02] transition-all duration-200 disabled:cursor-not-allowed transform"
                        >
                            {loading ? (
                                <div className="border-2 border-white border-t-transparent rounded-full w-5 h-5 animate-spin"></div>
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center my-6">
                        <div className="flex-1 border-white/20 border-t"></div>
                        <span className="px-4 text-purple-300 text-sm">or</span>
                        <div className="flex-1 border-white/20 border-t"></div>
                    </div>

                    {/* Sign Up Link */}
                    <div className="text-center">
                        <span className="text-purple-200 text-sm">Don&apos;t have an account? </span>
                        <button
                            onClick={() => router.push("/signup")}
                            className="font-medium text-purple-300 hover:text-white transition-colors"
                        >
                            Create one now
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                
                .animate-blob {
                    animation: blob 7s infinite;
                }
                
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
            `}</style>
        </div>
    );
}