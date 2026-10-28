const BLOCK_BREAKS = /<(?:br|\/p|\/div|\/li|\/h[1-6]|\/blockquote)\s*>/gi;
function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", copy: "©", reg: "®", trade: "™" };
  return value.replace(/&#(\d+);/g, (_m, n: string) => { const c = Number(n); return c >= 0 && c <= 0x10ffff ? String.fromCodePoint(c) : ""; }).replace(/&#x([\da-f]+);/gi, (_m, n: string) => { const c = Number.parseInt(n, 16); return c >= 0 && c <= 0x10ffff ? String.fromCodePoint(c) : ""; }).replace(/&([a-z]+);/gi, (match, entity: string) => named[entity.toLowerCase()] ?? match);
}
export function htmlToReadableText(html: unknown): string {
  if (typeof html !== "string" || !html.trim()) return "";
  return decodeHtmlEntities(html.replace(/<\s*br\b[^>]*>/gi, "\n").replace(BLOCK_BREAKS, "\n").replace(/<\s*(?:div|p|li|h[1-6]|blockquote)\b[^>]*>/gi, "").replace(/<[^>]*>/g, "").replace(/\r/g, "")).replace(/[\t\u00a0 ]+\n/g, "\n").replace(/\n[\t ]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
export type ExportScene = { title: string; content?: unknown; order?: number };
export type ExportEpisode = { title: string; scenes: ExportScene[] };
export type ExportLayout = "readable" | "screenplay";
function formatBody(body: string, layout: ExportLayout): string {
  if (layout === "readable") return body || "[No scene content]";
  if (!body) return "[No scene content]";
  const lines = body.split("\n");
  const output: string[] = [];
  let dialogueNext = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { output.push(""); dialogueNext = false; continue; }
    const next = (lines[i + 1] || "").trim();
    const isCue = /^[A-Z][A-Z0-9 ._'’()-]{1,34}$/.test(line) && /[A-Z]/.test(line) && line.length <= 35;
    const isParenthetical = /^\([^)]*\)$/.test(line);
    if (isCue) { output.push("", "                    " + line, ""); dialogueNext = true; }
    else if (isParenthetical) { output.push("                         " + line); dialogueNext = true; }
    else if (dialogueNext) { output.push("               " + line); dialogueNext = false; }
    else { output.push(line); dialogueNext = false; }
    if (next && /^[A-Z][A-Z0-9 ._'’()-]{1,34}$/.test(next) && line.length > 35) dialogueNext = false;
  }
  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim() || "[No scene content]";
}
export function prepareSceneText(scene: ExportScene, index?: number, layout: ExportLayout = "readable"): string {
  const title = scene.title?.trim() || "Untitled scene";
  const body = formatBody(htmlToReadableText(scene.content), layout);
  const heading = index === undefined ? title.toUpperCase() : "SCENE " + (index + 1) + ": " + title.toUpperCase();
  if (layout === "screenplay") return heading + "\n\n" + body;
  return heading + "\n\n" + body;
}
export function prepareEpisodeText(episode: ExportEpisode, projectTitle: string, layout: ExportLayout = "readable"): string {
  const orderedScenes = [...episode.scenes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const lines = layout === "screenplay"
    ? [(projectTitle || "Untitled story").trim().toUpperCase(), "", (episode.title || "Untitled episode").trim().toUpperCase(), "", "FADE IN:", ""]
    : [(projectTitle || "Untitled story").trim(), (episode.title || "Untitled episode").trim(), "", "=".repeat(56), ""];
  orderedScenes.forEach((scene, index) => {
    if (index > 0) lines.push("", layout === "screenplay" ? "                                      * * *" : "-".repeat(56), "");
    lines.push(prepareSceneText(scene, index, layout));
  });
  if (!orderedScenes.length) lines.push("[This episode has no scenes yet.]");
  if (layout === "screenplay") lines.push("", "FADE OUT.");
  return lines.join("\n").trim() + "\n";
}
