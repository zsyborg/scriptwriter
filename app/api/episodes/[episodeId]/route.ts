import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getActiveWriterSession } from "@/lib/auth";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ episodeId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getActiveWriterSession(request);
  if (!session || session.role !== "writer" || !session.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
  try {
    const { episodeId } = await context.params;
    if (!ObjectId.isValid(episodeId)) return NextResponse.json({ error: "Invalid episode ID." }, { status: 400 });
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 120) return NextResponse.json({ error: "Episode title is required (max 120 characters)." }, { status: 400 });
    const db = await getDb();
    const result = await db.collection("episodes").findOneAndUpdate(
      { _id: new ObjectId(episodeId) },
      { $set: { title, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!result) return NextResponse.json({ error: "Episode not found." }, { status: 404 });
    await db.collection("projects").updateOne({ _id: new ObjectId(result.projectId) }, { $set: { updatedAt: new Date() } });
    return NextResponse.json({ ...result, _id: result._id.toString() });
  } catch (error) {
    console.error("Rename episode failed:", error);
    return NextResponse.json({ error: "Could not rename episode." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getActiveWriterSession(request);
  if (!session || session.role !== "writer" || !session.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
  try {
    const { episodeId } = await context.params;
    if (!ObjectId.isValid(episodeId)) return NextResponse.json({ error: "Invalid episode ID." }, { status: 400 });
    const db = await getDb();
    const episode = await db.collection("episodes").findOne({ _id: new ObjectId(episodeId) });
    if (!episode) return NextResponse.json({ error: "Episode not found." }, { status: 404 });
    await db.collection("scenes").deleteMany({ episodeId });
    await db.collection("episodes").deleteOne({ _id: episode._id });
    await db.collection("projects").updateOne(
      { _id: new ObjectId(episode.projectId) },
      { $set: { updatedAt: new Date() }, $inc: { episodeCount: -1 } }
    );
    const remainingEpisodes = await db.collection("episodes").find({ projectId: episode.projectId }).sort({ order: 1, createdAt: 1 }).toArray();
    for (const [order, remainingEpisode] of remainingEpisodes.entries()) {
      await db.collection("episodes").updateOne({ _id: remainingEpisode._id }, { $set: { order, updatedAt: new Date() } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete episode failed:", error);
    return NextResponse.json({ error: "Could not delete episode." }, { status: 503 });
  }
}
