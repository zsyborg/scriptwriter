"use client";

import { useCallback, useEffect, useState } from "react";
import { History, X, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

type Version = {
  _id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  version: number;
  action: string;
  fields: string[];
  summary: string;
  editedBy: { username: string };
  createdAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

const labels: Record<string, string> = {
  scene: "Scene",
  character: "Character",
  location: "Location",
  creature: "Creature",
};

const pretty = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value ?? "", null, 2);

function htmlToReadableText(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const normalized = value
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ");
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(normalized, "text/html");
    return (doc.body.textContent || "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  return normalized.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

type DiffPart = { type: "same" | "added" | "removed"; text: string };

// A bounded LCS diff keeps comparisons responsive even for long scripts.
function diffText(before: string, after: string): DiffPart[] {
  const oldLines = before.split(/\n/);
  const newLines = after.split(/\n/);
  if (oldLines.length > 220 || newLines.length > 220 || oldLines.length * newLines.length > 30000) {
    let start = 0;
    while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
    let oldEnd = oldLines.length - 1;
    let newEnd = newLines.length - 1;
    while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) { oldEnd--; newEnd--; }
    const parts: DiffPart[] = [];
    if (start) parts.push({ type: "same", text: oldLines.slice(0, start).join("\n") });
    if (oldEnd >= start) parts.push({ type: "removed", text: oldLines.slice(start, oldEnd + 1).join("\n") });
    if (newEnd >= start) parts.push({ type: "added", text: newLines.slice(start, newEnd + 1).join("\n") });
    if (oldEnd < oldLines.length - 1) parts.push({ type: "same", text: oldLines.slice(oldEnd + 1).join("\n") });
    return parts.filter((part) => part.text.trim());
  }

  const rows = oldLines.length + 1;
  const cols = newLines.length + 1;
  const lcs = Array.from({ length: rows }, () => new Uint16Array(cols));
  for (let i = oldLines.length - 1; i >= 0; i--) {
    for (let j = newLines.length - 1; j >= 0; j--) {
      lcs[i][j] = oldLines[i] === newLines[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart["type"], line: string) => {
    const last = parts[parts.length - 1];
    if (last?.type === type) last.text += "\n" + line;
    else parts.push({ type, text: line });
  };
  let i = 0;
  let j = 0;
  while (i < oldLines.length && j < newLines.length) {
    if (oldLines[i] === newLines[j]) {
      push("same", oldLines[i]); i++; j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("removed", oldLines[i++]);
    } else {
      push("added", newLines[j++]);
    }
  }
  while (i < oldLines.length) push("removed", oldLines[i++]);
  while (j < newLines.length) push("added", newLines[j++]);
  return parts;
}

function SceneContentDiff({ before, after }: { before: unknown; after: unknown }) {
  const oldText = htmlToReadableText(before);
  const newText = htmlToReadableText(after);
  const parts = diffText(oldText, newText);
  const hasChanges = parts.some((part) => part.type !== "same");
  if (!hasChanges) return <p className="version-diff-empty">No text changes detected in this revision.</p>;
  return (
    <div className="version-scene-diff">
      {/* <p className="version-diff-note">Only changed passages are shown. Unchanged script text is hidden.</p> */}
      {parts.filter((part) => part.type !== "same").map((part, index) => (
        <section className={"version-diff-change version-diff-" + part.type} key={index}>
          <strong>{part.type === "removed" ? "− Removed" : "+ Added"}</strong>
          <pre>{part.text || "(empty)"}</pre>
        </section>
      ))}
    </div>
  );
}

export default function VersionHistory({
  projectId,
  entityType,
  entityId,
}: {
  projectId: string;
  entityType?: string;
  entityId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (entityId) params.set("entityId", entityId);
      const response = await fetch("/api/projects/" + projectId + "/history?" + params.toString());
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load history.");
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load history.");
    } finally {
      setLoading(false);
    }
  }, [projectId, entityType, entityId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function restore(row: Version) {
    if (!window.confirm("Restore version " + row.version + " of \"" + row.entityName + "\"? A new revision will be recorded.")) return;
    setRestoring(true);
    setError("");
    try {
      const response = await fetch("/api/projects/" + projectId + "/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: row._id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not restore version.");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not restore version.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <button type="button" className="version-history-trigger" onClick={() => setOpen(true)}>
        <History size={15} /> Version history
      </button>
      {open && (
        <div className="version-history-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <section className="version-history-dialog" role="dialog" aria-modal="true" aria-labelledby="version-history-title">
            <header>
              <div>
                <span>REVISION CONTROL</span>
                <h2 id="version-history-title">Version history</h2>
                <p>Review who changed what, compare saved content, or restore an earlier state.</p>
              </div>
              <button aria-label="Close history" onClick={() => setOpen(false)}><X size={18} /></button>
            </header>
            {error && <p className="version-history-error" role="alert">{error}</p>}
            {loading ? <p className="version-history-empty">Loading revisions…</p> : !rows.length ? (
              <p className="version-history-empty">No revisions yet. New edits will appear here.</p>
            ) : (
              <div className="version-history-list">
                {rows.map((row) => (
                  <article key={row._id} className="version-history-item">
                    <button className="version-history-row" onClick={() => setSelected(selected === row._id ? null : row._id)}>
                      <span className="version-badge">v{row.version}</span>
                      <span className="version-main">
                        <strong>{row.entityName || "Untitled"} <small>{labels[row.entityType] || row.entityType}</small></strong>
                        <span>{row.summary}</span>
                        <small>By {row.editedBy?.username || "Unknown"} · {new Date(row.createdAt).toLocaleString()}</small>
                      </span>
                      {selected === row._id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {selected === row._id && (
                      <div className="version-detail">
                        <p><strong>Changed fields:</strong> {row.fields?.join(", ") || row.action}</p>
                        {row.fields?.map((field) => (
                          <section className="version-diff" key={field}>
                            <h4>{field}</h4>
                            {row.entityType === "scene" && field === "content" ? (
                              <SceneContentDiff before={row.before?.[field]} after={row.after?.[field]} />
                            ) : (
                              <>
                                <div><span>Previous</span><pre>{row.before ? pretty(row.before[field]) : "—"}</pre></div>
                                <div><span>Saved</span><pre>{row.after ? pretty(row.after[field]) : "—"}</pre></div>
                              </>
                            )}
                          </section>
                        ))}
                        {row.before && (
                          <button className="version-restore" disabled={restoring} onClick={() => void restore(row)}>
                            <RotateCcw size={14} />{restoring ? "Restoring…" : "Restore state before this edit"}
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
            <footer><span>Showing up to 200 recent changes.</span><button onClick={() => void load()} disabled={loading}>Refresh</button></footer>
          </section>
        </div>
      )}
    </>
  );
}
