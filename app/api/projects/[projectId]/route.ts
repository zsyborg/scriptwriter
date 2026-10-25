import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { readSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const session = readSessionFromRequest(request);
  if (!session || session.role !== "writer" || !session.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
  try {
    const { projectId } = await context.params;
    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
    }
    const db = await getDb();
    const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId), ownerId: session.userId });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ ...project, _id: project._id.toString() });
  } catch (error) {
    console.error("Get project failed:", error);
    return NextResponse.json({ error: "Could not load this project." }, { status: 503 });
  }
}