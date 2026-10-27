"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Eye, EyeOff, KeyRound, LogOut, Plus, ShieldCheck, UserRound, UsersRound } from "lucide-react";

type User = { _id: string; username: string; active?: boolean; createdAt?: string };

export default function AdminPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("zasha");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    const response = await fetch("/api/admin/users");
    if (response.status === 403) { setAuthenticated(false); return; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load users.");
    setUsers(data);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then(async (data) => {
      if (data.user?.role === "admin") { setAuthenticated(true); await loadUsers(); }
    }).catch(() => {}).finally(() => setChecking(false));
  }, [loadUsers]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setLoginError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, role: "admin" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Admin login failed.");
      setAuthenticated(true); setPassword(""); await loadUsers();
    } catch (err) { setLoginError(err instanceof Error ? err.message : "Could not sign in."); }
    finally { setBusy(false); }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: newUsername, password: newPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create user.");
      setUsers((current) => [data, ...current]); setNewUsername(""); setNewPassword(""); setMessage(`Writer account “${data.username}” created.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create user."); }
  }

  async function updateUser(user: User, values: { password?: string; active?: boolean }) {
    setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user._id, ...values }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update account.");
      if (values.active !== undefined) setUsers((current) => current.map((item) => item._id === user._id ? { ...item, active: values.active } : item));
      if (values.password) setResetPasswords((current) => ({ ...current, [user._id]: "" }));
      setMessage(values.password ? `Password changed for “${user.username}”.` : `Account ${values.active ? "enabled" : "disabled"}.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update account."); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false); setUsers([]); setPassword(""); setMessage("");
  }

  if (checking) return <main className="auth-page"><div className="auth-loading">Opening admin console…</div></main>;

  if (!authenticated) return <main className="auth-page"><section className="auth-card admin-login-card">
    <Link href="/login" className="auth-back"><ArrowLeft size={15} /> Writer login</Link>
    <div className="admin-shield"><ShieldCheck size={24} /></div><div className="auth-eyebrow">RESTRICTED ACCESS</div><h1>Admin console<span className="auth-brand-dot">.</span></h1><p className="auth-subtitle">Manage writer accounts and passwords.</p>
    <form className="auth-form" onSubmit={login}>
      <label>Admin username<div className="auth-input-wrap"><UserRound size={17} /><input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={80} /></div></label>
      <label>Admin password<div className="auth-input-wrap"><KeyRound size={17} /><input autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={200} /><button type="button" className="auth-eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
      {loginError && <p className="auth-error" role="alert">{loginError}</p>}
      <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Verifying…" : "Sign in as administrator"}</button>
    </form>
    <p className="auth-security-note">For security, configure ADMIN_USERNAME, ADMIN_PASSWORD, and SESSION_SECRET in your deployment environment.</p>
  </section></main>;

  return <main className="admin-page">
    <header className="admin-topbar"><Link href="/" className="auth-brand"><span className="auth-brand-icon"><ShieldCheck size={19} /></span><span>scriptwriter<span className="auth-brand-dot">.</span> <small>ADMIN</small></span></Link><button className="admin-logout" onClick={logout}><LogOut size={16} /> Sign out</button></header>
    <div className="admin-content"><div className="admin-heading"><div><div className="auth-eyebrow">ACCOUNT MANAGEMENT</div><h1>Writer accounts<span className="auth-brand-dot">.</span></h1><p>Create accounts, reset passwords, and control access.</p></div><div className="admin-count"><UsersRound size={19} /><strong>{users.length}</strong><span>accounts</span></div></div>
      {(message || error) && <div className={error ? "admin-alert error" : "admin-alert"} role="status">{error || message}<button onClick={() => { setError(""); setMessage(""); }}>Dismiss</button></div>}
      <section className="admin-panel"><div className="admin-panel-heading"><div className="admin-panel-icon"><Plus size={19} /></div><div><h2>Create a writer</h2><p>New accounts are saved in MongoDB’s <code>users</code> collection.</p></div></div>
        <form className="admin-create-form" onSubmit={createUser}><label>Username<input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="e.g. writer01" autoComplete="off" minLength={3} maxLength={40} pattern="[A-Za-z0-9._-]+" required /></label><label>Temporary password<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} maxLength={200} required /></label><button className="admin-primary" type="submit"><Plus size={16} /> Create account</button></form>
      </section>
      <section className="admin-panel"><div className="admin-panel-heading"><div className="admin-panel-icon"><UsersRound size={19} /></div><div><h2>All writers</h2><p>Passwords are never displayed; only password hashes are stored.</p></div></div>
        {!users.length ? <div className="admin-empty">No writer accounts yet. Create your first account above.</div> : <div className="admin-users-list">{users.map((user) => <article className="admin-user-row" key={user._id}><div className="admin-user-avatar">{user.username.slice(0,1).toUpperCase()}</div><div className="admin-user-info"><strong>{user.username}</strong><span>{user.active === false ? "Disabled" : "Active"}{user.createdAt ? ` · Created ${new Date(user.createdAt).toLocaleDateString()}` : ""}</span></div><div className="admin-user-actions"><form onSubmit={(event) => { event.preventDefault(); const nextPassword = resetPasswords[user._id] || ""; if (nextPassword.length < 8) { setError("New passwords must be at least 8 characters."); return; } void updateUser(user, { password: nextPassword }); }}><input aria-label={`New password for ${user.username}`} type="password" autoComplete="new-password" minLength={8} maxLength={200} placeholder="New password" value={resetPasswords[user._id] || ""} onChange={(e) => setResetPasswords((current) => ({ ...current, [user._id]: e.target.value }))} required /><button className="admin-small-button" type="submit" title="Change password"><Check size={15} /><span>Reset</span></button></form><button className="admin-toggle-button" onClick={() => void updateUser(user, { active: user.active === false })}>{user.active === false ? "Enable" : "Disable"}</button></div></article>)}</div>}
      </section>
      <p className="admin-footer-note">Admin login is separate from writer login. Keep administrator credentials private and change the initial password before public launch.</p>
    </div>
  </main>;
}
