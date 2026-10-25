import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getActiveWriterSession } from "@/lib/auth";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ episodeId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getActiveWriterSession(request);
  if (!session || session.role !== "writer" || !session.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
  try {
    const { episodeId } = await context.params;
    if (!ObjectId.isValid(episodeId)) return NextResponse.json({ error: "Invalid episode ID." }, { status: 400 });
    const db = await getDb();
    const episode = await db.collection("episodes").findOne({ _id: new ObjectId(episodeId) });
    if (!episode) return NextResponse.json({ error: "Episode not found." }, { status: 404 });
    const ownedProject = await db.collection("projects").findOne({ _id: new ObjectId(episode.projectId), ownerId: session.userId }, { projection: { _id: 1 } });
    if (!ownedProject) return NextResponse.json({ error: "Episode not found." }, { status: 404 });
    const scenes = await db.collection("scenes").find({ episodeId }).sort({ order: 1, createdAt: 1 }).toArray();
    return NextResponse.json(scenes.map((scene) => ({ ...scene, _id: scene._id.toString() })));
  } catch (error) {
    console.error("List scenes failed:", error);
    return NextResponse.json({ error: "Could not load scenes." }, { status: 503 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = readSessionFromRequest(request);
  if (!session || session.role !== "writer" || !session.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
  try {
    const { episodeId } = await context.params;
    if (!ObjectId.isValid(episodeId)) return NextResponse.json({ error: "Invalid episode ID." }, { status: 400 });
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 120) return NextResponse.json({ error: "Scene title is required (max 120 characters)." }, { status: 400 });
    const db = await getDb();
    const episode = await db.collection("episodes").findOne({ _id: new ObjectId(episodeId) });
    if (!episode) return NextResponse.json({ error: "Episode not found." }, { status: 404 });
    const ownedProject = await db.collection("projects").findOne({ _id: new ObjectId(episode.projectId), ownerId: session.userId }, { projection: { _id: 1 } });
    if (!ownedProject) return NextResponse.json({ error: "Episode not found." }, { status: 404 });
    const order = await db.collection("scenes").countDocuments({ episodeId });
    const now = new Date();
    const scene = { episodeId, projectId: episode.projectId, title, content: "", order, createdAt: now, updatedAt: now };
    const result = await db.collection("scenes").insertOne(scene);
    await db.collection("projects").updateOne({ _id: new ObjectId(episode.projectId) }, { $set: { updatedAt: now }, $inc: { sceneCount: 1 } });
    return NextResponse.json({ ...scene, _id: result.insertedId.toString() }, { status: 201 });
  } catch (error) {
    console.error("Create scene failed:", error);
    return NextResponse.json({ error: "Could not create scene." }, { status: 503 });
  }
}