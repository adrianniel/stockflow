"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/supabase/auth";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300/80 bg-white/70 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-white hover:text-[#07152e]"
    >
      Logout
    </button>
  );
}
