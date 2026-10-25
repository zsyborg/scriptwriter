import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getActiveWriterSession } from "@/lib/auth";
export const runtime = "nodejs";
type Context = { params: Promise<{ projectId: string }> };
export async function GET(request: NextRequest, context: Context) {
 const session = await getActiveWriterSession(request); if (!session?.userId) return NextResponse.json({error:"Please sign in as a writer."},{status:401});
 try { const {projectId}=await context.params; if(!ObjectId.isValid(projectId)) return NextResponse.json({error:"Invalid project ID."},{status:400});
 const db=await getDb(); const project=await db.collection("projects").findOne({_id:new ObjectId(projectId)},{projection:{_id:1}});
 if(!project) return NextResponse.json({error:"Project not found."},{status:404});
 const items=await db.collection("characters").find({projectId}).sort({name:1}).limit(500).toArray();
 return NextResponse.json(items.map(item=>({...item,_id:item._id.toString()})));
 } catch(e) { console.error("List characters failed:",e); return NextResponse.json({error:"Could not load characters."},{status:503}); }
}
export async function POST(request: NextRequest, context: Context) {
 const session=await getActiveWriterSession(request); if(!session?.userId) return NextResponse.json({error:"Please sign in as a writer."},{status:401});
 try { const {projectId}=await context.params; if(!ObjectId.isValid(projectId)) return NextResponse.json({error:"Invalid project ID."},{status:400});
 const db=await getDb(); if(!await db.collection("projects").findOne({_id:new ObjectId(projectId)},{projection:{_id:1}})) return NextResponse.json({error:"Project not found."},{status:404});
 const body=await request.json() as Record<string,unknown>; const name=typeof body.name==="string"?body.name.trim():"";
 if(!name||name.length>100) return NextResponse.json({error:"Character name is required (max 100 characters)."},{status:400});
 const fields:Record<string,string>={name}; for(const key of ["description","appearance","personality","notes"]) { if(body[key]!==undefined) { if(typeof body[key]!=="string"||(body[key] as string).length>3000) return NextResponse.json({error:key+" must be text up to 3000 characters."},{status:400}); fields[key]=(body[key] as string).trim(); } }
 if(await db.collection("characters").findOne({projectId,name})) return NextResponse.json({error:"A character with this name already exists."},{status:409});
 const now=new Date(); const item={projectId,...fields,createdAt:now,updatedAt:now}; const result=await db.collection("characters").insertOne(item);
 return NextResponse.json({...item,_id:result.insertedId.toString()},{status:201});
 } catch(e) { console.error("Create characters failed:",e); return NextResponse.json({error:"Could not create character."},{status:503}); }
}
