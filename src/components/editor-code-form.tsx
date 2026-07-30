"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EditorCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    router.push(`/portal/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Your editor code"
        autoComplete="off"
        autoCapitalize="off"
      />
      <Button type="submit" className="shrink-0">
        Continue →
      </Button>
    </form>
  );
}
