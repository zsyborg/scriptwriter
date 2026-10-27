import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { hashPassword, readSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

function requireAdmin(request: NextRequest) {
  const session = readSessionFromRequest(request);
  return session?.role === "admin";
}

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const db = await getDb();
    const users = await db.collection("users").find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: -1 }).limit(500).toArray();
    return NextResponse.json(users.map((user) => ({ ...user, _id: user._id.toString() })));
  } catch (error) {
    console.error("List users failed:", error);
    return NextResponse.json({ error: "Could not load users." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return NextResponse.json({ error: "Username must be 3–40 characters using letters, numbers, dots, underscores, or hyphens." }, { status: 400 });
    }
    if (password.length < 8 || password.length > 200) {
      return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
    }
    const db = await getDb();
    const existing = await db.collection("users").findOne({ username });
    if (existing) return NextResponse.json({ error: "That username already exists." }, { status: 409 });
    const now = new Date();
    const result = await db.collection("users").insertOne({
      username,
      passwordHash: await hashPassword(password),
      role: "writer",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ _id: result.insertedId.toString(), username, role: "writer", active: true, createdAt: now }, { status: 201 });
  } catch (error) {
    console.error("Create user failed:", error);
    return NextResponse.json({ error: "Could not create user." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  try {
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "";
    const password = typeof body.password === "string" ? body.password : "";
    const active = typeof body.active === "boolean" ? body.active : undefined;
    if (!userId || (!password && active === undefined)) {
      return NextResponse.json({ error: "Provide a user ID and a new password or active status." }, { status: 400 });
    }
    if (password && (password.length < 8 || password.length > 200)) {
      return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
    }
    const { ObjectId } = await import("mongodb");
    if (!ObjectId.isValid(userId)) return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (password) update.passwordHash = await hashPassword(password);
    if (active !== undefined) update.active = active;
    const db = await getDb();
    const result = await db.collection("users").updateOne({ _id: new ObjectId(userId) }, { $set: update });
    if (!result.matchedCount) return NextResponse.json({ error: "User not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update user failed:", error);
    return NextResponse.json({ error: "Could not update user." }, { status: 503 });
  }
}
