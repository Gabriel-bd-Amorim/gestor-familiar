"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function Refresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible" && !document.querySelector("input:focus,textarea:focus,select:focus")) router.refresh(); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [router]);
  return null;
}
