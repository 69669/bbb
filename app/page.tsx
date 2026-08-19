"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/tools/gen-license");
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-white/40">加载中...</div>
    </div>
  );
}
