"use client";
import Link from "next/link";
import { useSession } from "next-auth/react";

// eslint-disable-next-line @next/next/no-async-client-component
export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") return <p>Loading...</p>;
  if (!session) {
    return (
      <div className="flex flex-col justify-center items-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 px-4 min-h-screen">
        <h1 className="mb-6 font-bold text-white text-3xl">Welcome to AI Interview</h1>
        <p className="mb-6 text-gray-400">Please log in or sign up to continue</p>

        <div className="flex gap-4">
          <Link
            href="/login"
            className="bg-blue-600 hover:bg-blue-500 shadow-md px-6 py-3 rounded-lg font-semibold text-white transition-all"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="bg-cyan-600 hover:bg-cyan-500 shadow-md px-6 py-3 rounded-lg font-semibold text-white transition-all"
          >
            Signup
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex justify-center items-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 px-4 min-h-screen overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="top-20 left-20 absolute bg-blue-500/10 blur-3xl rounded-full w-72 h-72 animate-pulse"></div>
        <div className="right-20 bottom-20 absolute bg-purple-500/10 blur-3xl rounded-full w-96 h-96 animate-pulse delay-1000"></div>
        <div className="top-1/2 left-1/2 absolute bg-cyan-500/5 blur-3xl rounded-full w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      <div className="z-10 relative mx-auto max-w-2xl text-center">
        {/* Logo/Badge */}
        <div className="inline-flex justify-center items-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-50 blur-xl rounded-full animate-pulse"></div>
            <div className="relative flex justify-center items-center bg-gradient-to-br from-blue-500 to-cyan-600 shadow-2xl rounded-2xl w-20 h-20">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Main heading with gradient */}
        <h1 className="bg-300% bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-400 mb-6 font-bold text-transparent text-5xl md:text-7xl animate-gradient">
          AI Interview
        </h1>

        <p className="mx-auto mb-12 max-w-md text-gray-300 text-lg md:text-xl leading-relaxed">
          Join a secure call and complete a short, AI-led screening interview
        </p>

        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <span className="bg-blue-500/10 backdrop-blur-sm px-4 py-2 border border-blue-500/20 rounded-full text-blue-300 text-sm">
            ✨ AI-Powered
          </span>
          <span className="bg-cyan-500/10 backdrop-blur-sm px-4 py-2 border border-cyan-500/20 rounded-full text-cyan-300 text-sm">
            🔒 Secure & Private
          </span>
          <span className="bg-purple-500/10 backdrop-blur-sm px-4 py-2 border border-purple-500/20 rounded-full text-purple-300 text-sm">
            ⚡ Real-time Analysis
          </span>
        </div>

        {/* Enhanced CTA button */}
        <Link href="/interview" className="group inline-flex relative items-center gap-3 bg-gradient-to-r from-blue-600 hover:from-blue-500 to-cyan-600 hover:to-cyan-500 shadow-xl hover:shadow-2xl px-8 py-4 rounded-full font-semibold text-white text-lg hover:scale-105 transition-all duration-300">
          <span>Start Interview</span>
          <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>

          {/* Button glow effect */}
          <div className="-z-10 absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 opacity-50 group-hover:opacity-70 blur-lg rounded-full transition-opacity"></div>
        </Link>

        {/* Bottom hint text */}
        <p className="mt-8 text-gray-500 text-sm">
          Typically takes 15-20 minutes • No preparation needed
        </p>
      </div>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
        .bg-300\% {
          background-size: 300% 300%;
        }
      `}</style>
    </div>
  );
}