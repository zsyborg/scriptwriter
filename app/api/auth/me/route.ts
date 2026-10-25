import { NextRequest, NextResponse } from "next/server";
import { getActiveWriterSession, readSessionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = readSessionFromRequest(request);
  if (!session) return NextResponse.json({ user: null }, { status: 200 });
  if (session.role === "writer" && !(await getActiveWriterSession(request))) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({ user: { username: session.username, role: session.role } });
}
