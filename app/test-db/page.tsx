
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TestDatabasePage() {
  const [result, setResult] = useState("Connecting to Supabase...");

  useEffect(() => {
    async function testConnection() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .limit(10);

      if (error) {
        setResult("Database error: " + error.message);
        return;
      }

      setResult(JSON.stringify(data, null, 2));
    }

    testConnection();
  }, []);

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>CampusBite — Database Test</h1>
      <pre style={{ whiteSpace: "pre-wrap", marginTop: "20px" }}>
        {result}
      </pre>
    </main>
  );
}
