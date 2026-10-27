import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getActiveWriterSession, readSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

const COLOR_MODES = new Set([
  "light", "dark", "red", "orange", "yellow", "green",
  "blue", "purple", "pink", "brown", "black", "gray",
]);

async function getPreferenceOwner(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) return null;
  if (session.role === "writer") {
    const active = await getActiveWriterSession(request);
    if (!active || !active.userId) return null;
    return { ownerId: `writer:${active.userId}`, username: active.username, role: active.role };
  }
  if (session.role === "admin") {
    return { ownerId: `admin:${session.username.toLowerCase()}`, username: session.username, role: session.role };
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const owner = await getPreferenceOwner(request);
    if (!owner) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const db = await getDb();
    const preference = await db.collection("user_preferences").findOne(
      { ownerId: owner.ownerId },
      { projection: { _id: 0, colorMode: 1 } },
    );
    return NextResponse.json({ colorMode: preference?.colorMode ?? null });
  } catch (error) {
    console.error("Get user preferences failed:", error);
    return NextResponse.json({ error: "Could not load preferences." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const owner = await getPreferenceOwner(request);
    if (!owner) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json();
    const colorMode = typeof body.colorMode === "string" ? body.colorMode : "";
    if (!COLOR_MODES.has(colorMode)) {
      return NextResponse.json({ error: "Choose a valid color mode." }, { status: 400 });
    }
    const now = new Date();
    const db = await getDb();
    await db.collection("user_preferences").updateOne(
      { ownerId: owner.ownerId },
      { $set: { ownerId: owner.ownerId, username: owner.username, role: owner.role, colorMode, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    return NextResponse.json({ success: true, colorMode });
  } catch (error) {
    console.error("Save user preferences failed:", error);
    return NextResponse.json({ error: "Could not save preferences." }, { status: 503 });
  }
}
