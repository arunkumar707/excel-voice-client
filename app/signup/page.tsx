"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { PasswordInput } from "@/components/PasswordInput";
import { apiClient } from "@/lib/nest-auth-fetch";

const fieldDelay = 0.22;

export default function SignupPage() {
  const router = useRouter();
  const passwordId = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await apiClient.post("/auth/register", {
        username: username.trim(),
        password,
      });
      setUsername("");
      setPassword("");
      router.replace("/login?toast=registered");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Choose a user id and password (min. 6 characters)"
      footerLink={{ href: "/login", label: "Already have an account? Sign in" }}
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {err ? (
          <p className="rounded-lg border border-rose-900/50 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">
            {err}
          </p>
        ) : null}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: fieldDelay, duration: 0.35 }}
        >
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            User ID
          </label>
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. farmer01"
            className="w-full rounded-xl border border-slate-600 bg-slate-950/80 px-4 py-3 text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: fieldDelay + 0.06, duration: 0.35 }}
        >
          <label
            htmlFor={passwordId}
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            Password
          </label>
          <PasswordInput
            id={passwordId}
            value={password}
            onChange={setPassword}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: fieldDelay + 0.1, duration: 0.35 }}
        >
          <button
            type="submit"
            disabled={busy || !username.trim() || password.length < 6}
            className="mt-2 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-transform hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "Creating…" : "Sign up"}
          </button>
        </motion.div>
      </form>
    </AuthShell>
  );
}
