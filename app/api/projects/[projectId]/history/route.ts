import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getActiveWriterSession } from "@/lib/auth";
import { collectionForVersion, recordVersion, type VersionEntityType } from "@/lib/versioning";
export const runtime = "nodejs";
type Context = { params: Promise<{ projectId: string }> };
export async function GET(request: NextRequest, context: Context) {
 const session = await getActiveWriterSession(request); if (!session?.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
 try { const { projectId } = await context.params; if (!ObjectId.isValid(projectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 }); const db = await getDb();
 if (!await db.collection("projects").findOne({ _id: new ObjectId(projectId) }, { projection: { _id: 1 } })) return NextResponse.json({ error: "Project not found." }, { status: 404 });
 const type = request.nextUrl.searchParams.get("entityType"), id = request.nextUrl.searchParams.get("entityId"); const filter: Record<string, unknown> = { projectId }; if (type && collectionForVersion(type)) filter.entityType = type; if (id && ObjectId.isValid(id)) filter.entityId = id;
 const rows = await db.collection("script_versions").find(filter).sort({ createdAt: -1 }).limit(200).toArray();
 return NextResponse.json(rows.map(({ before, after, ...row }) => ({ ...row, _id: row._id.toString(), before: before ?? null, after: after ?? null, createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt })));
 } catch (error) { console.error("Load version history failed:", error); return NextResponse.json({ error: "Could not load version history." }, { status: 503 }); }
}
export async function POST(request: NextRequest, context: Context) {
 const session = await getActiveWriterSession(request); if (!session?.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
 try { const { projectId } = await context.params; if (!ObjectId.isValid(projectId)) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 }); const body = await request.json(); if (typeof body.versionId !== "string" || !ObjectId.isValid(body.versionId)) return NextResponse.json({ error: "Choose a valid version to restore." }, { status: 400 }); const db = await getDb();
 if (!await db.collection("projects").findOne({ _id: new ObjectId(projectId) }, { projection: { _id: 1 } })) return NextResponse.json({ error: "Project not found." }, { status: 404 });
 const version = await db.collection("script_versions").findOne({ _id: new ObjectId(body.versionId), projectId }); if (!version || !version.before || !collectionForVersion(version.entityType)) return NextResponse.json({ error: "This version cannot be restored." }, { status: 400 });
 const collection = collectionForVersion(version.entityType)!; const filter = { _id: new ObjectId(version.entityId), projectId }; const current = await db.collection(collection).findOne(filter);
 const restored = { ...version.before } as Record<string, unknown>; delete restored._id; delete restored.projectId; delete restored.createdAt; delete restored.updatedAt; restored.updatedAt = new Date();
 let result: import("mongodb").WithId<import("mongodb").Document> | null;
 if (!current && version.action === "deleted") { await db.collection(collection).insertOne({ ...restored, projectId, createdAt: new Date(), _id: new ObjectId(version.entityId) }); result = await db.collection(collection).findOne(filter); }
 else if (!current) return NextResponse.json({ error: "The entry no longer exists." }, { status: 404 });
 else result = await db.collection(collection).findOneAndUpdate(filter, { $set: restored }, { returnDocument: "after" });
 if (!result) return NextResponse.json({ error: "Could not restore this version." }, { status: 409 });
 await recordVersion(db, { projectId, entityType: version.entityType as VersionEntityType, entityId: version.entityId, entityName: version.entityName || current?.title || current?.name || "Untitled", actor: session, before: current, after: result, action: "restored" });
 return NextResponse.json({ success: true, item: { ...result, _id: result._id.toString() } });
 } catch (error) { console.error("Restore version failed:", error); return NextResponse.json({ error: "Could not restore version." }, { status: 503 }); }
}