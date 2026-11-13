
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, Utensils, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        });

        if (error) throw error;

        if (!data.session) {
          setMessage(
            "Registration submitted. Check your email for a confirmation link."
          );
        } else {
          router.push("/");
          router.refresh();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8f7f2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#fff",
          borderRadius: 24,
          padding: 36,
          boxShadow: "0 20px 60px rgba(0,0,0,.07)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 28,
            color: "#1e4d3a",
          }}
        >
          <Utensils size={30} />
          <strong style={{ fontSize: 25 }}>campusbite.</strong>
        </div>

        <h1 style={{ fontSize: 30, fontWeight: 800, color: "#20392e" }}>
          {isSignup ? "Join CampusBite" : "Welcome back!"}
        </h1>

        <p style={{ color: "#777", marginTop: 8, marginBottom: 28 }}>
          {isSignup
            ? "Create your student account to get started."
            : "Sign in to continue your campus food journey."}
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          {isSignup && (
            <input
              required
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          )}

          <input
            required
            type="email"
            placeholder="College email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            required
            type="password"
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          {message && (
            <p
              role="status"
              style={{
                color: "#a34b28",
                background: "#fff4e8",
                padding: 12,
                borderRadius: 10,
                fontSize: 13,
              }}
            >
              {message}
            </p>
          )}

          <button
            disabled={loading}
            type="submit"
            style={{
              background: "#1e4d3a",
              color: "#fff",
              padding: 16,
              borderRadius: 12,
              border: "none",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                {isSignup ? "Create account" : "Sign in"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: "center", color: "#666" }}>
          {isSignup ? "Already have an account?" : "New to CampusBite?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setMessage("");
            }}
            style={{
              color: "#1e4d3a",
              fontWeight: 700,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            {isSignup ? "Sign in" : "Create account"}
          </button>
        </p>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "15px 16px",
  borderRadius: 12,
  border: "1px solid #ddd",
  outlineColor: "#1e4d3a",
  fontSize: 15,
  width: "100%",
  color: "#20392e",
  background: "#fff",
};

