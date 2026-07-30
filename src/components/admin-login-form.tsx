"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function AdminLoginForm() {
  const router = useRouter();
  const [loginCode, setLoginCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginCode, pin }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Login failed.");
        return;
      }
      router.push("/admin/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-4">
      <div>
        <Label>Owner code</Label>
        <Input
          value={loginCode}
          onChange={(e) => setLoginCode(e.target.value)}
          autoComplete="username"
          autoFocus
        />
      </div>
      <div>
        <Label>PIN</Label>
        <Input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="••••"
        />
      </div>
      {error && <p className="text-xs text-accent">{error}</p>}
      <Button type="submit" disabled={loading || pin.length < 4 || !loginCode} className="w-full">
        {loading ? "Checking…" : "Log in"}
      </Button>
    </form>
  );
}
