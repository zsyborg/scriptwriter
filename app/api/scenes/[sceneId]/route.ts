import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getActiveWriterSession } from "@/lib/auth";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sceneId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getActiveWriterSession(request);
  if (!session || session.role !== "writer" || !session.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
  try {
    const { sceneId } = await context.params;
    if (!ObjectId.isValid(sceneId)) return NextResponse.json({ error: "Invalid scene ID." }, { status: 400 });
    const body = await request.json();
    const update: { title?: string; content?: string; updatedAt: Date } = { updatedAt: new Date() };
    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title || title.length > 120) return NextResponse.json({ error: "Scene title is required (max 120 characters)." }, { status: 400 });
      update.title = title;
    }
    if (typeof body.content === "string") {
      if (body.content.length > 500_000) return NextResponse.json({ error: "Scene content is too large." }, { status: 413 });
      update.content = body.content;
    }
    if (!update.title && update.content === undefined) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    const db = await getDb();
    const existingScene = await db.collection("scenes").findOne({ _id: new ObjectId(sceneId) });
    if (!existingScene) return NextResponse.json({ error: "Scene not found." }, { status: 404 });
    const ownedProject = await db.collection("projects").findOne({ _id: new ObjectId(existingScene.projectId), ownerId: session.userId }, { projection: { _id: 1 } });
    if (!ownedProject) return NextResponse.json({ error: "Scene not found." }, { status: 404 });
    const result = await db.collection("scenes").findOneAndUpdate(
      { _id: new ObjectId(sceneId) },
      { $set: update },
      { returnDocument: "after" }
    );
    if (!result) return NextResponse.json({ error: "Scene not found." }, { status: 404 });
    return NextResponse.json({ ...result, _id: result._id.toString() });
  } catch (error) {
    console.error("Save scene failed:", error);
    return NextResponse.json({ error: "Could not save scene." }, { status: 503 });
  }
}