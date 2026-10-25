"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import LoginPage from "./login/page";
import { Tv, Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [hasCachedSession, setHasCachedSession] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const cached = !!localStorage.getItem("userRole");
      if (cached) {
        setHasCachedSession(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!loading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        // Firebase finished verification and no authenticated user was found
        setHasCachedSession(false);
      }
    } else if (hasCachedSession) {
      // Optimistically prefetch dashboard while Firebase validates the token
      router.prefetch("/dashboard");
    }
  }, [mounted, user, loading, hasCachedSession, router]);

  // If session is being verified or user is already authenticated / cached, show sleek splash screen
  if (!mounted || loading || user || hasCachedSession) {
    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Ambient Glow Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-gradient-to-tr from-orange-600/20 via-amber-600/10 to-red-600/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-5 max-w-sm px-4">
          {/* Animated Brand Logo */}
          <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-amber-600 via-orange-500 to-red-600 shadow-2xl shadow-orange-500/40 animate-pulse">
            <Tv className="w-9 h-9 sm:w-11 sm:h-11 text-white" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-400 border-2 border-slate-950"></span>
            </span>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Navanidhi Digital System
            </h1>
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold tracking-wider">
              <span className="text-slate-400">Official</span>
              <span className="text-orange-400 font-extrabold text-xs">dish<span className="text-red-500">tv</span></span>
              <span className="text-amber-400 font-extrabold">Partner</span>
            </div>
          </div>

          {/* Loading status indicator - matches perfectly between SSR and Client */}
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-medium text-slate-300 shadow-lg">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-500" />
            <span suppressHydrationWarning>Verifying session...</span>
          </div>
        </div>
      </div>
    );
  }

  // Render Login Page only when definitely unauthenticated
  return <LoginPage />;
}
