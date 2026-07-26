"use client";

import { useForm } from "react-hook-form";
import { signIn } from "@/lib/supabase/auth";
import { useState } from "react";
import { useRouter } from "next/navigation";


type LoginForm = {
  email: string;
  password: string;
};


export default function LoginPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
  } = useForm<LoginForm>();


  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);


  async function onSubmit(data: LoginForm) {

    try {

      setLoading(true);
      setError("");

      await signIn(
        data.email,
        data.password
      );

      router.replace("/dashboard");


    } catch (err: any) {

      setError(
        err.message || "Login failed"
      );

    } finally {

      setLoading(false);

    }
  }


  return (

    <main className="min-h-screen flex items-center justify-center bg-gray-100">

      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">


        <h1 className="text-3xl font-bold text-center">
          StockFlow
        </h1>


        <p className="text-center text-gray-500 mt-2">
          Inventory & Sales Management
        </p>


        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-8 space-y-4"
        >


          <div>

            <label className="block mb-1">
              Email
            </label>

            <input
              type="email"
              className="w-full border rounded-lg p-2"
              {...register("email")}
            />

          </div>



          <div>

            <label className="block mb-1">
              Password
            </label>

            <input
              type="password"
              className="w-full border rounded-lg p-2"
              {...register("password")}
            />

          </div>



          {error && (

            <p className="text-red-600 text-sm">
              {error}
            </p>

          )}



          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded-lg"
          >

            {loading ? "Signing in..." : "Sign In"}

          </button>


        </form>


      </div>

    </main>

  );
}