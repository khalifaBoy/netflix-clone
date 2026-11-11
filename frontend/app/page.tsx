"use client";

import { useAuth } from "@/context/Authcontext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();
  const { user, selectedProfile } = useAuth();
  useEffect(() => {
    if (user) {
      const params = new URLSearchParams({ p: selectedProfile?._id });
      router.push(`/browse?${params.toString()}`);
    } else router.push("/login");
  }, [user, selectedProfile, router]);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        Loading...
      </main>
    </div>
  );
}
