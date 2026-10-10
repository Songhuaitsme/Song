"use client";

import { useState } from "react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: data.get("username"), password: data.get("password"), returnTo }),
      });
      const result = await response.json() as { error?: string; returnTo?: string };
      if (!response.ok) throw new Error(result.error || "登录失败");
      window.location.assign(result.returnTo || "/studio");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
      setBusy(false);
    }
  }

  return <form className="login-form" onSubmit={submit}>
    <label>账号<Input name="username" autoComplete="username" required maxLength={160}/></label>
    <label>密码<Input name="password" type="password" autoComplete="current-password" required maxLength={1000}/></label>
    {error && <p className="login-error" role="alert">{error}</p>}
    <Button type="submit" disabled={busy}>{busy ? "正在验证…" : "进入工作室"}</Button>
  </form>;
}
