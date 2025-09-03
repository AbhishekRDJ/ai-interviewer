"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, User, Mail, Lock, Sparkles, ChevronLeft } from "lucide-react";

export default function SignupPage() {
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();

            if (res.ok) {
                router.push("/"); // Redirect after signup
            } else {
                alert(data.error || "Signup failed");
            }
        } catch (error) {
            console.error("Signup failed:", error);
            alert("Signup failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex justify-center items-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 min-h-screen overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="-top-40 -right-40 absolute bg-blue-500 opacity-20 blur-xl rounded-full w-80 h-80 animate-blob mix-blend-multiply filter"></div>
                <div className="-bottom-40 -left-40 absolute bg-purple-500 opacity-20 blur-xl rounded-full w-80 h-80 animate-blob animation-delay-2000 mix-blend-multiply filter"></div>
                <div className="top-40 left-40 absolute bg-cyan-500 opacity-20 blur-xl rounded-full w-80 h-80 animate-blob animation-delay-4000 mix-blend-multiply filter"></div>
            </div>

            <div className="relative w-full max-w-md">
                {/* Back button */}
                <button
                    onClick={() => router.push("/login")}
                    className="inline-flex items-center gap-2 mb-6 text-purple-200 hover:text-white transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back to login
                </button>

                {/* Logo/Brand section */}
                <div className="mb-8 text-center">
                    <div className="inline-flex justify-center items-center bg-gradient-to-r from-blue-600 to-cyan-600 shadow-lg mb-4 rounded-2xl w-16 h-16">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="bg-clip-text bg-gradient-to-r from-white to-blue-200 font-bold text-transparent text-3xl">
                        Join AI Interview Pro
                    </h1>
                    <p className="mt-2 text-blue-200 text-sm">Start your interview preparation journey</p>
                </div>

                {/* Signup Form */}
                <div className="bg-white/10 shadow-2xl backdrop-blur-lg p-8 border border-white/20 rounded-3xl">
                    <div className="mb-6 text-center">
                        <h2 className="mb-2 font-bold text-white text-2xl">Create Account</h2>
                        <p className="text-blue-200 text-sm">Get started in just a few clicks</p>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-6">
                        {/* Name Input */}
                        <div className="space-y-2">
                            <label className="block font-medium text-blue-200 text-sm">Full Name</label>
                            <div className="group relative">
                                <User className="top-1/2 left-3 absolute w-5 h-5 text-blue-400 group-focus-within:text-blue-300 transition-colors -translate-y-1/2 transform" />
                                <input
                                    type="text"
                                    placeholder="John Doe"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="bg-white/5 backdrop-blur-sm py-3 pr-4 pl-12 border border-white/20 focus:border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-white transition-all duration-200 placeholder-blue-300"
                                    required
                                />
                            </div>
                        </div>

                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="block font-medium text-blue-200 text-sm">Email Address</label>
                            <div className="group relative">
                                <Mail className="top-1/2 left-3 absolute w-5 h-5 text-blue-400 group-focus-within:text-blue-300 transition-colors -translate-y-1/2 transform" />
                                <input
                                    type="email"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="bg-white/5 backdrop-blur-sm py-3 pr-4 pl-12 border border-white/20 focus:border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-white transition-all duration-200 placeholder-blue-300"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="space-y-2">
                            <label className="block font-medium text-blue-200 text-sm">Password</label>
                            <div className="group relative">
                                <Lock className="top-1/2 left-3 absolute w-5 h-5 text-blue-400 group-focus-within:text-blue-300 transition-colors -translate-y-1/2 transform" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••••"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className="bg-white/5 backdrop-blur-sm py-3 pr-12 pl-12 border border-white/20 focus:border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full text-white transition-all duration-200 placeholder-blue-300"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="top-1/2 right-3 absolute text-blue-400 hover:text-blue-300 transition-colors -translate-y-1/2 transform"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Password strength indicator */}
                        <div className="text-blue-300 text-xs">
                            Password should be at least 8 characters long
                        </div>

                        {/* Terms and Conditions */}
                        <div className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                id="terms"
                                checked={agreeToTerms}
                                onChange={(e) => setAgreeToTerms(e.target.checked)}
                                className="bg-white/5 mt-1 border-white/20 rounded focus:ring-2 focus:ring-blue-500 w-4 h-4 text-blue-600"
                                required
                            />
                            <label htmlFor="terms" className="text-blue-200 text-sm">
                                I agree to the{" "}
                                <button
                                    type="button"
                                    className="text-blue-300 hover:text-white underline"
                                >
                                    Terms of Service
                                </button>{" "}
                                and{" "}
                                <button
                                    type="button"
                                    className="text-blue-300 hover:text-white underline"
                                >
                                    Privacy Policy
                                </button>
                            </label>
                        </div>

                        {/* Signup Button */}
                        <button
                            type="submit"
                            disabled={loading || !agreeToTerms}
                            className="flex justify-center items-center gap-2 bg-gradient-to-r from-blue-600 hover:from-blue-700 to-cyan-600 hover:to-cyan-700 disabled:opacity-50 px-6 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent w-full font-semibold text-white hover:scale-[1.02] transition-all duration-200 disabled:cursor-not-allowed transform"
                        >
                            {loading ? (
                                <div className="border-2 border-white border-t-transparent rounded-full w-5 h-5 animate-spin"></div>
                            ) : (
                                <>
                                    Create Account
                                    <Sparkles className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center my-6">
                        <div className="flex-1 border-white/20 border-t"></div>
                        <span className="px-4 text-blue-300 text-sm">or</span>
                        <div className="flex-1 border-white/20 border-t"></div>
                    </div>



                    {/* Sign In Link */}
                    <div className="mt-6 text-center">
                        <span className="text-blue-200 text-sm">Already have an account? </span>
                        <button
                            onClick={() => router.push("/login")}
                            className="font-medium text-blue-300 hover:text-white transition-colors"
                        >
                            Sign in instead
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