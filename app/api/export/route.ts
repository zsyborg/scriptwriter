import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getActiveWriterSession } from "@/lib/auth";
import { prepareEpisodeText, prepareSceneText, type ExportLayout } from "@/lib/script-export";
import { createDocx, createPdf, createZip } from "@/lib/export-formats";
export const runtime = "nodejs";
function safeFilename(value: unknown, fallback: string): string { const name = typeof value === "string" ? value.trim() : ""; const cleaned = name.normalize("NFKD").replace(/[^\w\s.-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80); return (cleaned || fallback).replace(/^\.+|\.+$/g, "") + ".txt"; }
export async function GET(request: NextRequest) {
  const session = await getActiveWriterSession(request); if (!session || session.role !== "writer" || !session.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
  try {
    const sceneId = request.nextUrl.searchParams.get("sceneId"); const episodeId = request.nextUrl.searchParams.get("episodeId"); const projectExportId = request.nextUrl.searchParams.get("projectId");
    const format = (request.nextUrl.searchParams.get("format") || "txt").toLowerCase();
    const layout = (request.nextUrl.searchParams.get("layout") || "readable").toLowerCase() as ExportLayout;
    const author = (request.nextUrl.searchParams.get("author") || "").slice(0, 120);
    const titlePage = request.nextUrl.searchParams.get("titlePage") !== "false";
    const pageBreaks = request.nextUrl.searchParams.get("pageBreaks") === "true";
    const sceneIds = (request.nextUrl.searchParams.get("sceneIds") || "").split(",").filter((id) => ObjectId.isValid(id));
    if (!["readable", "screenplay"].includes(layout)) return NextResponse.json({ error: "Unsupported script layout." }, { status: 400 });
    if (!["txt", "pdf", "docx"].includes(format)) return NextResponse.json({ error: "Unsupported export format." }, { status: 400 });
    if ([sceneId, episodeId, projectExportId].filter(Boolean).length !== 1) return NextResponse.json({ error: "Choose one scene, episode, or project to export." }, { status: 400 });
    const db = await getDb(); let text: string; let filename: string;
    if (sceneId) {
      if (!ObjectId.isValid(sceneId)) return NextResponse.json({ error: "Invalid scene ID." }, { status: 400 });
      const scene = await db.collection("scenes").findOne({ _id: new ObjectId(sceneId) }); if (!scene) return NextResponse.json({ error: "Scene not found." }, { status: 404 });
      const projectId = String(scene.projectId); if (!ObjectId.isValid(projectId) || !await db.collection("projects").findOne({ _id: new ObjectId(projectId) }, { projection: { _id: 1 } })) return NextResponse.json({ error: "Scene not found." }, { status: 404 });
      text = prepareSceneText({ title: String(scene.title || "Untitled scene"), content: scene.content }, undefined, layout, { pageBreaks }); filename = safeFilename(scene.title, "scene");
    } else {
      if (!episodeId || !ObjectId.isValid(episodeId)) return NextResponse.json({ error: "Invalid episode ID." }, { status: 400 });
      const episode = await db.collection("episodes").findOne({ _id: new ObjectId(episodeId) }); if (!episode) return NextResponse.json({ error: "Episode not found." }, { status: 404 });
      const projectId = String(episode.projectId); if (!ObjectId.isValid(projectId)) return NextResponse.json({ error: "Episode not found." }, { status: 404 });
      const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId) }, { projection: { title: 1, _id: 1 } }); if (!project) return NextResponse.json({ error: "Episode not found." }, { status: 404 });
      const sceneQuery: Record<string, unknown> = { episodeId: String(episode._id) };
      if (sceneIds.length) sceneQuery._id = { $in: sceneIds.map((id) => new ObjectId(id)) };
      const scenes = await db.collection("scenes").find(sceneQuery).sort({ order: 1, createdAt: 1 }).toArray();
      text = prepareEpisodeText({ title: String(episode.title || "Untitled episode"), scenes: scenes.map((scene) => ({ title: String(scene.title || "Untitled scene"), content: scene.content, order: typeof scene.order === "number" ? scene.order : 0 })) }, String(project.title || "Untitled story"), layout, { titlePage, author, pageBreaks }); filename = safeFilename(episode.title, "episode");
    }
    const baseName = filename.replace(/\.txt$/i, "");
    if (format === "pdf") return new NextResponse(createPdf(text), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${baseName}.pdf"`, "Cache-Control": "no-store" } });
    if (format === "docx") return new NextResponse(createDocx(text), { status: 200, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${baseName}.docx"`, "Cache-Control": "no-store" } });
    return new NextResponse(text, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
  } catch (error) { console.error("Script export failed:", error); return NextResponse.json({ error: "Could not export this script." }, { status: 503 }); }
}
