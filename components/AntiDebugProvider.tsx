"use client";
import { useEffect } from "react";
import { initAntiDebug } from "../lib/antiDebug";

export default function AntiDebugProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAntiDebug();
  }, []);
  return <>{children}</>;
}
