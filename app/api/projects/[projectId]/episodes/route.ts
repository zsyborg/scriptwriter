import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { readSessionFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const session = readSessionFromRequest(request);
  if (!session || session.role !== "writer" || !session.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
  try {
    const { projectId } = await context.params;
    if (!ObjectId.isValid(projectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
    const db = await getDb();
    const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId), ownerId: session.userId }, { projection: { _id: 1 } });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const episodes = await db.collection("episodes").find({ projectId }).sort({ order: 1, createdAt: 1 }).toArray();
    return NextResponse.json(episodes.map((episode) => ({ ...episode, _id: episode._id.toString() })));
  } catch (error) {
    console.error("List episodes failed:", error);
    return NextResponse.json({ error: "Could not load episodes." }, { status: 503 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = readSessionFromRequest(request);
  if (!session || session.role !== "writer" || !session.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
  try {
    const { projectId } = await context.params;
    if (!ObjectId.isValid(projectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 });
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 120) return NextResponse.json({ error: "Episode title is required (max 120 characters)." }, { status: 400 });
    const db = await getDb();
    const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId), ownerId: session.userId }, { projection: { _id: 1 } });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const order = await db.collection("episodes").countDocuments({ projectId });
    const now = new Date();
    const episode = { projectId, title, description: "", order, createdAt: now, updatedAt: now };
    const result = await db.collection("episodes").insertOne(episode);
    await db.collection("projects").updateOne({ _id: new ObjectId(projectId) }, { $set: { updatedAt: now }, $inc: { episodeCount: 1 } });
    return NextResponse.json({ ...episode, _id: result.insertedId.toString() }, { status: 201 });
  } catch (error) {
    console.error("Create episode failed:", error);
    return NextResponse.json({ error: "Could not create episode." }, { status: 503 });
  }
}