"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clapperboard, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, role: "writer" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Login failed.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally { setBusy(false); }
  }

  return <main className="auth-page"><section className="auth-card">
    <Link href="/" className="auth-brand"><span className="auth-brand-icon"><Clapperboard size={20} /></span><span>scriptwriter<span className="auth-brand-dot">.</span></span></Link>
    <div className="auth-eyebrow">YOUR CREATIVE SPACE</div><h1>Welcome back<span className="auth-brand-dot">.</span></h1><p className="auth-subtitle">Sign in to pick up where your imagination left off.</p>
    <form className="auth-form" onSubmit={submit}>
      <label>Username<div className="auth-input-wrap"><UserRound size={17} /><input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username" required maxLength={80} /></div></label>
      <label>Password<div className="auth-input-wrap"><LockKeyhole size={17} /><input autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required maxLength={200} /><button type="button" className="auth-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in to workspace"}</button>
    </form>
    <div className="auth-bottom">Need an account? Ask your administrator to create one.</div>
    <Link href="/admin" className="auth-admin-link">Administrator sign in <span>↗</span></Link>
  </section></main>;
}
