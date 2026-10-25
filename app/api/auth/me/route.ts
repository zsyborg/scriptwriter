import { NextRequest, NextResponse } from "next/server";
import { readSessionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({ user: { username: session.username, role: session.role } });
}
