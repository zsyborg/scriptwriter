const BLOCK_BREAKS = /<(?:br|\/p|\/div|\/li|\/h[1-6]|\/blockquote)\s*>/gi;
function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"' , apos: "'", nbsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", copy: "©", reg: "®", trade: "™" };
  return value.replace(/&#(\d+);/g, (_m, n: string) => { const c = Number(n); return c >= 0 && c <= 0x10ffff ? String.fromCodePoint(c) : ""; }).replace(/&#x([\da-f]+);/gi, (_m, n: string) => { const c = Number.parseInt(n, 16); return c >= 0 && c <= 0x10ffff ? String.fromCodePoint(c) : ""; }).replace(/&([a-z]+);/gi, (match, entity: string) => named[entity.toLowerCase()] ?? match);
}
export function htmlToReadableText(html: unknown): string {
  if (typeof html !== "string" || !html.trim()) return "";
  return decodeHtmlEntities(html.replace(/<\s*br\b[^>]*>/gi, "\n").replace(BLOCK_BREAKS, "\n").replace(/<\s*(?:div|p|li|h[1-6]|blockquote)\b[^>]*>/gi, "").replace(/<[^>]*>/g, "").replace(/\r/g, "")).replace(/[\t\u00a0 ]+\n/g, "\n").replace(/\n[\t ]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
export type ExportScene = { title: string; content?: unknown; order?: number };
export type ExportEpisode = { title: string; scenes: ExportScene[] };
export function prepareSceneText(scene: ExportScene, index?: number): string {
  const title = scene.title?.trim() || "Untitled scene"; const body = htmlToReadableText(scene.content);
  const heading = index === undefined ? title.toUpperCase() : "SCENE " + (index + 1) + ": " + title.toUpperCase();
  return body ? heading + "\n\n" + body : heading + "\n\n[No scene content]";
}
export function prepareEpisodeText(episode: ExportEpisode, projectTitle: string): string {
  const lines = [(projectTitle || "Untitled story").trim(), (episode.title || "Untitled episode").trim(), "", "=".repeat(56), ""];
  const orderedScenes = [...episode.scenes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  orderedScenes.forEach((scene, index) => { if (index > 0) lines.push("", "-".repeat(56), ""); lines.push(prepareSceneText(scene, index)); });
  if (!orderedScenes.length) lines.push("[This episode has no scenes yet.]"); return lines.join("\n").trim() + "\n";
}
