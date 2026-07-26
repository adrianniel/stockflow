import { redirect } from "next/navigation";
import { getCurrentUser, getUserProfile } from "@/lib/supabase/auth";


export default async function DashboardPage() {

  const user = await getCurrentUser();


  if (!user) {
    redirect("/login");
  }


  const profile = await getUserProfile();


  if (!profile) {
    return (
      <main className="p-10">
        <h1 className="text-xl font-bold">
          Profile not found
        </h1>

        <p>
          Your authentication account exists,
          but no StockFlow user profile exists.
        </p>
      </main>
    );
  }


  if (profile.role === "SUPER_ADMIN") {
    redirect("/dashboard/admin");
  }


  if (profile.role === "OWNER") {
    redirect("/dashboard/owner");
  }


  if (profile.role === "ASSISTANT") {
    redirect("/dashboard/assistant");
  }


  return null;
}