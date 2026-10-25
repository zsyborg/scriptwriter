import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { adminCredentialsMatch, createSession, sessionCookie, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = body.role === "admin" ? "admin" : "writer";
    if (!username || !password || username.length > 80 || password.length > 200) {
      return NextResponse.json({ error: "Enter a valid username and password." }, { status: 400 });
    }

    if (role === "admin") {
      if (!adminCredentialsMatch(username, password)) {
        return NextResponse.json({ error: "Incorrect admin username or password." }, { status: 401 });
      }
      const response = NextResponse.json({ username, role: "admin" });
      response.headers.set("Set-Cookie", sessionCookie(createSession(username, "admin")));
      return response;
    }

    const db = await getDb();
    const user = await db.collection("users").findOne({ username: username.toLowerCase(), active: { $ne: false } });
    if (!user || typeof user.passwordHash !== "string" || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
    }
    const response = NextResponse.json({ username: user.username, role: "writer" });
    response.headers.set("Set-Cookie", sessionCookie(createSession(user.username, "writer", user._id.toString())));
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "Login service is unavailable. Check server configuration." }, { status: 503 });
  }
}
