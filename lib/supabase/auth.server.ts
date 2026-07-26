import { createSupabaseServerClient } from "./server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user;
}

export async function getUserProfile(authId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("users")
    .select(`
      id,
      name,
      role,
      shop_id
    `)
    .eq("auth_id", authId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}