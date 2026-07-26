import { supabase } from "./client";


export async function signIn(
  email: string,
  password: string
) {

  console.log("Attempting login:", email);


  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });


  console.log("Supabase response:", data);
  console.log("Supabase error:", error);


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
