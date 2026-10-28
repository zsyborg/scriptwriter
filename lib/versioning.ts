import type { Db, Document } from "mongodb";
import type { SessionUser } from "@/lib/auth";
export type VersionEntityType = "scene" | "character" | "location" | "creature";
const collections: Record<VersionEntityType, string> = { scene: "scenes", character: "characters", location: "locations", creature: "creatures" };
const ignored = new Set(["_id", "projectId", "createdAt", "updatedAt"]);
function clean(value: Document) { const out: Record<string, unknown> = {}; for (const [key, item] of Object.entries(value)) if (!ignored.has(key)) out[key] = item; return out; }
export function changedFields(before: Document, after: Document) { const a = clean(before), b = clean(after); return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null)); }
export async function recordVersion(db: Db, input: { projectId: string; entityType: VersionEntityType; entityId: string; entityName: string; actor: SessionUser; before: Document | null; after: Document | null; action?: "created" | "updated" | "deleted" | "restored" }) {
 const { projectId, entityType, entityId, entityName, actor, before, after } = input; const action = input.action ?? "updated";
 const fields = before && after ? changedFields(before, after) : Object.keys(clean((before ?? after ?? {}) as Document)); if (action === "updated" && !fields.length) return null;
 const col = db.collection("script_versions"); const version = await col.countDocuments({ projectId, entityType, entityId }) + 1;
 const summary = action === "created" ? "Created entry" : action === "deleted" ? "Deleted entry" : action === "restored" ? "Restored an earlier version" : fields.length ? "Changed " + fields.slice(0, 4).join(", ") + (fields.length > 4 ? " and " + (fields.length - 4) + " more" : "") : "Saved changes";
 const doc = { projectId, entityType, entityId, entityName, version, action, fields, summary, editedBy: { userId: actor.userId ?? "", username: actor.username, role: actor.role }, createdAt: new Date(), before: before ? clean(before as Document) : null, after: after ? clean(after as Document) : null };
 const result = await col.insertOne(doc); return { ...doc, _id: result.insertedId.toString() };
}
export function collectionForVersion(type: string) { return Object.prototype.hasOwnProperty.call(collections, type) ? collections[type as VersionEntityType] : null; }