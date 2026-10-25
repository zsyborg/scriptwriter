import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getActiveWriterSession } from "@/lib/auth";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ sceneId: string }> };

function sanitizeSceneContent(input:string){
 let html=input.slice(0,500000).replace(/<\s*(script|style|iframe|object|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,"");
 html=html.replace(/<(?!\/?(?:span|br|div|p)\b)[^>]*>/gi,"");
 html=html.replace(/<span\b([^>]*)>/gi,(_m,attrs:string)=>{const type=attrs.match(/data-entity-type=["'](character|location)["']/i)?.[1]?.toLowerCase();const id=attrs.match(/data-entity-id=["']([a-f0-9]{24})["']/i)?.[1];const name=attrs.match(/data-entity-name=["']([^"']{1,100})["']/i)?.[1];if(!type||!id||!name)return "<span>";const safe=name.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");return '<span data-entity-type="'+type+'" data-entity-id="'+id+'" data-entity-name="'+safe+'" contenteditable="false" class="story-entity-mention">';});
 return html.replace(/<(br|div|p)\b[^>]*>/gi,(_m,tag:string)=>tag.toLowerCase()==="br"?"<br>":"<div>");
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getActiveWriterSession(request);
  if (!session || session.role !== "writer" || !session.userId) return NextResponse.json({ error: "Please sign in as a writer." }, { status: 401 });
  try {
    const { sceneId } = await context.params;
    if (!ObjectId.isValid(sceneId)) return NextResponse.json({ error: "Invalid scene ID." }, { status: 400 });
    const body = await request.json();
    const update: { title?: string; content?: string; characterIds?: string[]; locationIds?: string[]; updatedAt: Date } = { updatedAt: new Date() };
    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title || title.length > 120) return NextResponse.json({ error: "Scene title is required (max 120 characters)." }, { status: 400 });
      update.title = title;
    }
    if (typeof body.content === "string") {
      if (body.content.length > 500_000) return NextResponse.json({ error: "Scene content is too large." }, { status: 413 });
      update.content = sanitizeSceneContent(body.content);
    }
    if (body.characterIds !== undefined) {
      if (!Array.isArray(body.characterIds) || body.characterIds.some((id: unknown) => typeof id !== "string" || !ObjectId.isValid(id)) || body.characterIds.length > 100) return NextResponse.json({ error: "Invalid character references." }, { status: 400 });
      update.characterIds = [...new Set(body.characterIds as string[])];
    }
    if (body.locationIds !== undefined) {
      if (!Array.isArray(body.locationIds) || body.locationIds.some((id: unknown) => typeof id !== "string" || !ObjectId.isValid(id)) || body.locationIds.length > 100) return NextResponse.json({ error: "Invalid location references." }, { status: 400 });
      update.locationIds = [...new Set(body.locationIds as string[])];
    }
    if (!update.title && update.content === undefined && update.characterIds === undefined && update.locationIds === undefined) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    const db = await getDb();
    const existingScene = await db.collection("scenes").findOne({ _id: new ObjectId(sceneId) });
    if (!existingScene) return NextResponse.json({ error: "Scene not found." }, { status: 404 });
    const ownedProject = await db.collection("projects").findOne({ _id: new ObjectId(existingScene.projectId), ownerId: session.userId }, { projection: { _id: 1 } });
    if (!ownedProject) return NextResponse.json({ error: "Scene not found." }, { status: 404 });
    if(typeof update.content==="string"){
      const mentions=[...update.content.matchAll(/data-entity-type="(character|location)" data-entity-id="([a-f0-9]{24})"/gi)];
      for(const mention of mentions){const collection=mention[1].toLowerCase()==="character"?"characters":"locations";const found=await db.collection(collection).findOne({_id:new ObjectId(mention[2]),projectId:existingScene.projectId},{projection:{_id:1}});if(!found)return NextResponse.json({error:"A linked character or location does not belong to this project."},{status:400});}
      const cids=[...new Set(mentions.filter(m=>m[1].toLowerCase()==="character").map(m=>m[2]))];const lids=[...new Set(mentions.filter(m=>m[1].toLowerCase()==="location").map(m=>m[2]))];
      if(cids.length)update.characterIds=[...new Set([...(update.characterIds??((existingScene.characterIds as string[])||[])),...cids])];
      if(lids.length)update.locationIds=[...new Set([...(update.locationIds??((existingScene.locationIds as string[])||[])),...lids])];
    }
    if (update.characterIds !== undefined && update.characterIds.length) {
      const count = await db.collection("characters").countDocuments({ _id: { $in: update.characterIds.map((id) => new ObjectId(id)) }, projectId: existingScene.projectId });
      if (count !== update.characterIds.length) return NextResponse.json({ error: "One or more characters do not belong to this project." }, { status: 400 });
    }
    if (update.locationIds !== undefined && update.locationIds.length) {
      const count = await db.collection("locations").countDocuments({ _id: { $in: update.locationIds.map((id) => new ObjectId(id)) }, projectId: existingScene.projectId });
      if (count !== update.locationIds.length) return NextResponse.json({ error: "One or more locations do not belong to this project." }, { status: 400 });
    }
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