import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getActiveWriterSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getActiveWriterSession(request);
  if (!session || session.role !== "writer" || !session.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
  try {
    const db = await getDb();
    const projects = await db.collection("projects").find({ ownerId: session.userId }).sort({ updatedAt: -1 }).limit(100).toArray();
    return NextResponse.json(projects.map((project) => ({ ...project, _id: project._id.toString() })));
  } catch (error) {
    console.error("List projects failed:", error);
    return NextResponse.json({ error: "Could not load projects. Check your MongoDB configuration." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getActiveWriterSession(request);
  if (!session || session.role !== "writer" || !session.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!title || title.length > 100) {
      return NextResponse.json({ error: "Title is required and must be 100 characters or fewer." }, { status: 400 });
    }
    if (description.length > 500) {
      return NextResponse.json({ error: "Description must be 500 characters or fewer." }, { status: 400 });
    }

    const now = new Date();
    const project = {
      title,
      description,
      ownerId: session.userId,
      createdAt: now,
      updatedAt: now,
      episodeCount: 0,
      sceneCount: 0,
      color: ["lavender", "peach", "mint"][Math.floor(Math.random() * 3)],
    };

    const db = await getDb();
    const result = await db.collection("projects").insertOne(project);
    return NextResponse.json({ ...project, _id: result.insertedId.toString() }, { status: 201 });
  } catch (error) {
    console.error("Create project failed:", error);
    return NextResponse.json({ error: "Could not save the project. Check your MongoDB configuration." }, { status: 503 });
  }
}