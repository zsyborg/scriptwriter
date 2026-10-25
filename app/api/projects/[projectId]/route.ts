import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    if (!ObjectId.isValid(projectId)) {
      return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
    }
    const db = await getDb();
    const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId) });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ ...project, _id: project._id.toString() });
  } catch (error) {
    console.error("Get project failed:", error);
    return NextResponse.json({ error: "Could not load this project." }, { status: 503 });
  }
}