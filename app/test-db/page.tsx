import { supabase } from "@/lib/supabase/client";

export default async function TestDatabasePage() {
  const { data, error } = await supabase
    .from("shops")
    .select("*");

  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold">
        Supabase Connection Test
      </h1>

      <div className="mt-5">
        {error ? (
          <div>
            <h2 className="font-bold text-red-600">
              Connection Failed
            </h2>

            <pre>
              {error.message}
            </pre>
          </div>
        ) : (
          <div>
            <h2 className="font-bold text-green-600">
              Connection Successful
            </h2>

            <pre>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}