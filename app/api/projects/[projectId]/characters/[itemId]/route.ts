import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { getActiveWriterSession } from "@/lib/auth";
import { recordVersion } from "@/lib/versioning";
export const runtime = "nodejs";
type Context = { params: Promise<{ projectId: string; itemId: string }> };
export async function PATCH(request: NextRequest, context: Context) {
 const session=await getActiveWriterSession(request); if(!session?.userId) return NextResponse.json({error:"Please sign in as a writer."},{status:401});
 try { const {projectId,itemId}=await context.params; if(!ObjectId.isValid(projectId)||!ObjectId.isValid(itemId)) return NextResponse.json({error:"Invalid ID."},{status:400});
 const db=await getDb(); if(!await db.collection("projects").findOne({_id:new ObjectId(projectId)},{projection:{_id:1}})) return NextResponse.json({error:"Project not found."},{status:404});
 const body=await request.json() as Record<string,unknown>; const update:Record<string,string|Date>={updatedAt:new Date()};
 if(body.name!==undefined) { const name=typeof body.name==="string"?body.name.trim():""; if(!name||name.length>100) return NextResponse.json({error:"Character name is required (max 100 characters)."},{status:400}); if(await db.collection("characters").findOne({projectId,name,_id:{$ne:new ObjectId(itemId)}})) return NextResponse.json({error:"A character with this name already exists."},{status:409}); update.name=name; }
 for(const key of ["description","appearance","personality","weapons","abilities","notes"]) if(body[key]!==undefined) { if(typeof body[key]!=="string"||(body[key] as string).length>3000) return NextResponse.json({error:key+" must be text up to 3000 characters."},{status:400}); update[key]=(body[key] as string).trim(); }
 if(Object.keys(update).length===1) return NextResponse.json({error:"Nothing to update."},{status:400});
 const before=await db.collection("characters").findOne({_id:new ObjectId(itemId),projectId});
 const item=await db.collection("characters").findOneAndUpdate({_id:new ObjectId(itemId),projectId},{$set:update},{returnDocument:"after"});
 if(!item) return NextResponse.json({error:"Character not found."},{status:404}); if(before) await recordVersion(db,{projectId,entityType:"character",entityId:itemId,entityName:String(item.name||"character"),actor:session,before,after:item}); return NextResponse.json({...item,_id:item._id.toString()});
 } catch(e) { console.error("Update characters failed:",e); return NextResponse.json({error:"Could not update character."},{status:503}); }
}
export async function DELETE(request: NextRequest, context: Context) {
 const session=await getActiveWriterSession(request); if(!session?.userId) return NextResponse.json({error:"Please sign in as a writer."},{status:401});
 try { const {projectId,itemId}=await context.params; if(!ObjectId.isValid(projectId)||!ObjectId.isValid(itemId)) return NextResponse.json({error:"Invalid ID."},{status:400});
 const db=await getDb(); if(!await db.collection("projects").findOne({_id:new ObjectId(projectId)},{projection:{_id:1}})) return NextResponse.json({error:"Project not found."},{status:404});
 const deleted=await db.collection("characters").findOne({_id:new ObjectId(itemId),projectId}); if(!deleted) return NextResponse.json({error:"Character not found."},{status:404}); const result=await db.collection("characters").deleteOne({_id:new ObjectId(itemId),projectId}); if(!result.deletedCount) return NextResponse.json({error:"Character not found."},{status:404}); await recordVersion(db,{projectId,entityType:"character",entityId:itemId,entityName:String(deleted.name||"character"),actor:session,before:deleted,after:null,action:"deleted"});
 await db.collection("scenes").updateMany({projectId},[{$set:{characterIds:{$filter:{input:{$ifNull:["$characterIds",[]]},as:"referenceId",cond:{$ne:["$referenceId",itemId]}}}}}]); return NextResponse.json({success:true});
 } catch(e) { console.error("Delete characters failed:",e); return NextResponse.json({error:"Could not delete character."},{status:503}); }
}
