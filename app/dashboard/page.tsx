import { redirect } from "next/navigation";
import { getCurrentUser, getUserProfile } from "@/lib/supabase/auth.server";


export default async function DashboardPage() {

  const user = await getCurrentUser();


  if (!user) {
    redirect("/login");
  }


  const profile = await getUserProfile(user.id);


  if (!profile) {
    redirect("/login");
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

  redirect("/login");
}