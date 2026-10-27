import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getActiveWriterSession } from "@/lib/auth";
export const runtime = "nodejs";
type Context = { params: Promise<{ projectId: string; itemId: string }> };
export async function PATCH(request: NextRequest, context: Context) {
 const session=await getActiveWriterSession(request); if(!session?.userId) return NextResponse.json({error:"Please sign in as a writer."},{status:401});
 try { const {projectId,itemId}=await context.params; if(!ObjectId.isValid(projectId)||!ObjectId.isValid(itemId)) return NextResponse.json({error:"Invalid ID."},{status:400});
 const db=await getDb(); if(!await db.collection("projects").findOne({_id:new ObjectId(projectId)},{projection:{_id:1}})) return NextResponse.json({error:"Project not found."},{status:404});
 const body=await request.json() as Record<string,unknown>; const update:Record<string,string|Date>={updatedAt:new Date()};
 if(body.name!==undefined) { const name=typeof body.name==="string"?body.name.trim():""; if(!name||name.length>100) return NextResponse.json({error:"Creature name is required (max 100 characters)."},{status:400}); if(await db.collection("creatures").findOne({projectId,name,_id:{$ne:new ObjectId(itemId)}})) return NextResponse.json({error:"A creature with this name already exists."},{status:409}); update.name=name; }
 if(body.creatureType!==undefined){if(typeof body.creatureType!=="string"||!["good","bad","divine"].includes(body.creatureType))return NextResponse.json({error:"Creature type must be good, bad, or divine."},{status:400});update.creatureType=body.creatureType;} for(const key of ["description","abilities","powers","weaknesses","notes"]) if(body[key]!==undefined) { if(typeof body[key]!=="string"||(body[key] as string).length>3000) return NextResponse.json({error:key+" must be text up to 3000 characters."},{status:400}); update[key]=(body[key] as string).trim(); }
 if(Object.keys(update).length===1) return NextResponse.json({error:"Nothing to update."},{status:400});
 const item=await db.collection("creatures").findOneAndUpdate({_id:new ObjectId(itemId),projectId},{$set:update},{returnDocument:"after"});
 if(!item) return NextResponse.json({error:"Creature not found."},{status:404}); return NextResponse.json({...item,_id:item._id.toString()});
 } catch(e) { console.error("Update creatures failed:",e); return NextResponse.json({error:"Could not update creature."},{status:503}); }
}
export async function DELETE(request: NextRequest, context: Context) {
 const session=await getActiveWriterSession(request); if(!session?.userId) return NextResponse.json({error:"Please sign in as a writer."},{status:401});
 try { const {projectId,itemId}=await context.params; if(!ObjectId.isValid(projectId)||!ObjectId.isValid(itemId)) return NextResponse.json({error:"Invalid ID."},{status:400});
 const db=await getDb(); if(!await db.collection("projects").findOne({_id:new ObjectId(projectId)},{projection:{_id:1}})) return NextResponse.json({error:"Project not found."},{status:404});
 const result=await db.collection("creatures").deleteOne({_id:new ObjectId(itemId),projectId}); if(!result.deletedCount) return NextResponse.json({error:"Creature not found."},{status:404});
 return NextResponse.json({success:true});
 } catch(e) { console.error("Delete creatures failed:",e); return NextResponse.json({error:"Could not delete creature."},{status:503}); }
}
