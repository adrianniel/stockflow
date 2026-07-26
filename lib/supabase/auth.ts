import { supabase } from "./client";


export async function signIn(
  email: string,
  password: string
) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    throw error;
  }

  return data;
}


export async function signOut() {
  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}


export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getUserProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }


  const { data, error } = await supabase
    .from("users")
    .select(`
      id,
      name,
      role,
      shop_id
    `)
    .eq("auth_id", user.id)
    .single();


  if (error) {
    throw error;
  }


  return data;
}