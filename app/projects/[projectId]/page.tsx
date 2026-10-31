"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Check, ChevronDown, Clock3, Download, FilePlus2, MapPin, Pencil, Plus, Save, Trash2, UsersRound, Sparkles } from "lucide-react";
import WorldLibrary from "./world-library";
import SceneContentEditor from "./scene-content-editor";
import VersionHistory from "./version-history";

type Project = { _id: string; title: string; description?: string };
type Episode = { _id: string; title: string; order: number };
type Scene = { _id: string; episodeId: string; title: string; content: string; order: number; characterIds?: string[]; locationIds?: string[] };
type LibraryItem = { _id: string; name: string; description?: string; appearance?: string; personality?: string; notes?: string; details?: string; weapons?: string; abilities?: string; creatureType?: string; powers?: string; weaknesses?: string };

export default function ProjectWorkspace() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params.projectId;
  const [project, setProject] = useState<Project | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [sceneTitle, setSceneTitle] = useState("");
  const [newEpisodeTitle, setNewEpisodeTitle] = useState("");
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [sceneTargetEpisodeId, setSceneTargetEpisodeId] = useState("");
  const [showEpisodeInput, setShowEpisodeInput] = useState(false);
  const [showSceneInput, setShowSceneInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("All changes saved");
  const [error, setError] = useState("");
  const [exportFormat, setExportFormat] = useState<"txt" | "pdf" | "docx">("txt");
  const [exportLayout, setExportLayout] = useState<"readable" | "screenplay">("readable");
  const [selectedExportScenes, setSelectedExportScenes] = useState<string[]>([]);
  const [selectedExportEpisodes, setSelectedExportEpisodes] = useState<string[]>([]);
  const [exportAuthor, setExportAuthor] = useState("");
  const [exportTitlePage, setExportTitlePage] = useState(true);
  const [exportScenePageBreaks, setExportScenePageBreaks] = useState(false);
  const [characters, setCharacters] = useState<LibraryItem[]>([]);
  const [locations, setLocations] = useState<LibraryItem[]>([]);
  const [creatures, setCreatures] = useState<LibraryItem[]>([]);
  const [activeLibrary, setActiveLibrary] = useState<"characters" | "locations" | "creatures" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentScene = scenes.find((scene) => scene._id === selectedScene) ?? null;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me").then((response) => response.json()).then((data) => { if (!cancelled && data.user?.role !== "writer") router.replace("/login"); }).catch(() => { if (!cancelled) router.replace("/login"); });
    async function load() {
      try {
        const [projectResponse, episodeResponse, characterResponse, locationResponse, creatureResponse] = await Promise.all([
          fetch(`/api/projects/${projectId}`), fetch(`/api/projects/${projectId}/episodes`),
          fetch(`/api/projects/${projectId}/characters`), fetch(`/api/projects/${projectId}/locations`), fetch(`/api/projects/${projectId}/creatures`),
        ]);
        if (!projectResponse.ok || !episodeResponse.ok) throw new Error("Could not load this story. Check the database connection.");
        const [projectData, episodeData, characterData, locationData, creatureData] = await Promise.all([projectResponse.json(), episodeResponse.json(), characterResponse.ok ? characterResponse.json() : [], locationResponse.ok ? locationResponse.json() : [], creatureResponse.ok ? creatureResponse.json() : []]);
        if (cancelled) return;
        setProject(projectData); setEpisodes(episodeData); setCharacters(characterData); setLocations(locationData); setCreatures(creatureData);
        if (episodeData.length) setSceneTargetEpisodeId(episodeData[0]._id);
        if (episodeData.length) {
          const sceneResponses = await Promise.all(episodeData.map((episode: Episode) => fetch(`/api/episodes/${episode._id}/scenes`)));
          const sceneGroups = await Promise.all(sceneResponses.map((response) => response.ok ? response.json() : []));
          if (cancelled) return;
          const allScenes: Scene[] = sceneGroups.flat();
          setScenes(allScenes);
          if (allScenes.length) {
            setSelectedScene(allScenes[0]._id);
            setDraft(allScenes[0].content || "");
            setSceneTitle(allScenes[0].title);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
    load();
    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current); };
  }, [projectId, router]);

  const saveScene = useCallback(async (sceneId: string, title: string, content: string) => {
    if (!sceneId) return;
    setSaving(true);
    setSaveState("Saving…");
    try {
      const response = await fetch(`/api/scenes/${sceneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!response.ok) throw new Error("Save failed");
      const updated = await response.json();
      setScenes((current) => current.map((scene) => scene._id === sceneId ? { ...scene, ...updated } : scene));
      setSaveState("All changes saved");
    } catch {
      setSaveState("Couldn't save — retry by editing");
    } finally {
      setSaving(false);
    }
  }, []);

  function changeDraft(value: string) {
    setDraft(value);
    setSaveState("Unsaved changes");
    if (timer.current) clearTimeout(timer.current);
    if (currentScene) timer.current = setTimeout(() => saveScene(currentScene._id, sceneTitle, value), 800);
  }

  function selectScene(scene: Scene) {
    if (timer.current) clearTimeout(timer.current);
    setSelectedScene(scene._id);
    setDraft(scene.content || "");
    setSceneTitle(scene.title);
    setSaveState("All changes saved");
  }

  async function addEpisode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newEpisodeTitle.trim();
    if (!title) return;
    const response = await fetch(`/api/projects/${projectId}/episodes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (!response.ok) { setError("Could not create episode."); return; }
    const episode = await response.json();
    setEpisodes((current) => [...current, episode]);
    setNewEpisodeTitle("");
    setShowEpisodeInput(false);
    setError("");
  }

  async function renameEpisode(episode: Episode) {
    const enteredTitle = window.prompt("Rename episode", episode.title);
    if (enteredTitle === null) return;
    const title = enteredTitle.trim();
    if (!title) { setError("Episode title cannot be empty."); return; }
    if (title.length > 120) { setError("Episode titles must be 120 characters or fewer."); return; }
    if (title === episode.title) return;
    const response = await fetch(`/api/episodes/${episode._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || "Could not rename episode."); return; }
    setEpisodes((current) => current.map((item) => item._id === episode._id ? { ...item, title: data.title } : item));
    setError("");
  }

  async function deleteEpisode(episode: Episode) {
    if (!window.confirm(`Delete "${episode.title}" and all of its scenes? This cannot be undone.`)) return;
    const response = await fetch(`/api/episodes/${episode._id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || "Could not delete episode."); return; }

    const deletedSceneIds = new Set(scenes.filter((scene) => scene.episodeId === episode._id).map((scene) => scene._id));
    const remainingScenes = scenes.filter((scene) => scene.episodeId !== episode._id);
    setEpisodes((current) => current.filter((item) => item._id !== episode._id));
    setScenes(remainingScenes);
    setSelectedExportEpisodes((current) => current.filter((id) => id !== episode._id));
    setSelectedExportScenes((current) => current.filter((id) => !deletedSceneIds.has(id)));
    if (currentScene && deletedSceneIds.has(currentScene._id)) {
      const nextScene = remainingScenes[0];
      if (nextScene) selectScene(nextScene);
      else { setSelectedScene(""); setDraft(""); setSceneTitle(""); setSaveState("All changes saved"); }
    }
    if (sceneTargetEpisodeId === episode._id) {
      const nextEpisode = episodes.find((item) => item._id !== episode._id);
      setSceneTargetEpisodeId(nextEpisode?._id || "");
    }
    setError("");
  }

  async function moveEpisode(episodeId: string, direction: -1 | 1) {
    const currentIndex = episodes.findIndex((episode) => episode._id === episodeId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= episodes.length) return;
    const reordered = [...episodes];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    setEpisodes(reordered);
    const response = await fetch(`/api/projects/${projectId}/episodes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ episodeIds: reordered.map((episode) => episode._id) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setEpisodes((current) => [...current].sort((a, b) => a.order - b.order));
      setError(data.error || "Could not reorder episodes.");
      return;
    }
    setEpisodes(data);
    setError("");
  }

  async function renameScene(scene: Scene) {
    const enteredTitle = window.prompt("Rename scene", scene.title);
    if (enteredTitle === null) return;
    const title = enteredTitle.trim();
    if (!title) { setError("Scene title cannot be empty."); return; }
    if (title.length > 120) { setError("Scene titles must be 120 characters or fewer."); return; }
    if (title === scene.title) return;
    const response = await fetch(`/api/scenes/${scene._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || "Could not rename scene."); return; }
    setScenes((current) => current.map((item) => item._id === scene._id ? { ...item, title: data.title } : item));
    if (selectedScene === scene._id) setSceneTitle(data.title);
    setError("");
  }

  async function deleteScene(scene: Scene) {
    if (!window.confirm(`Delete "${scene.title}"? This cannot be undone.`)) return;
    if (timer.current) clearTimeout(timer.current);
    const response = await fetch(`/api/scenes/${scene._id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setError(data.error || "Could not delete scene."); return; }
    const remainingScenes = scenes.filter((item) => item._id !== scene._id);
    setScenes(remainingScenes);
    setSelectedExportScenes((current) => current.filter((id) => id !== scene._id));
    if (selectedScene === scene._id) {
      const nextScene = remainingScenes.find((item) => item.episodeId === scene.episodeId) || remainingScenes[0];
      if (nextScene) selectScene(nextScene);
      else { setSelectedScene(""); setDraft(""); setSceneTitle(""); setSaveState("All changes saved"); }
    }
    setError("");
  }

  async function moveScene(sceneId: string, direction: -1 | 1) {
    const scene = scenes.find((item) => item._id === sceneId);
    if (!scene) return;
    const episodeScenes = scenes.filter((item) => item.episodeId === scene.episodeId).sort((a, b) => a.order - b.order);
    const currentIndex = episodeScenes.findIndex((item) => item._id === sceneId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= episodeScenes.length) return;
    const reorderedEpisodeScenes = [...episodeScenes];
    [reorderedEpisodeScenes[currentIndex], reorderedEpisodeScenes[targetIndex]] = [reorderedEpisodeScenes[targetIndex], reorderedEpisodeScenes[currentIndex]];
    const reordered = [...scenes.filter((item) => item.episodeId !== scene.episodeId), ...reorderedEpisodeScenes];
    setScenes(reordered);
    const response = await fetch(`/api/episodes/${scene.episodeId}/scenes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneIds: reorderedEpisodeScenes.map((item) => item._id) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setScenes((current) => [...current].sort((a, b) => {
        const episodeOrderA = episodes.find((item) => item._id === a.episodeId)?.order ?? 0;
        const episodeOrderB = episodes.find((item) => item._id === b.episodeId)?.order ?? 0;
        return episodeOrderA - episodeOrderB || a.order - b.order;
      }));
      setError(data.error || "Could not reorder scenes.");
      return;
    }
    setScenes((current) => current.map((item) => {
      const updated = data.find((result: Scene) => result._id === item._id);
      return updated ? { ...item, order: updated.order } : item;
    }));
    setError("");
  }

  async function addScene(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newSceneTitle.trim();
    if (!title || !episodes.length || !sceneTargetEpisodeId) return;
    const response = await fetch(`/api/episodes/${sceneTargetEpisodeId}/scenes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (!response.ok) { setError("Could not create scene."); return; }
    const scene = await response.json();
    setScenes((current) => [...current, scene]);
    selectScene(scene);
    setNewSceneTitle("");
    setShowSceneInput(false);
    setError("");
  }


  async function exportProject() {
    try {
      const params = new URLSearchParams({ projectId, format: exportFormat, layout: exportLayout, author: exportAuthor, titlePage: String(exportTitlePage), pageBreaks: "true" });
      if (selectedExportEpisodes.length) params.set("episodeIds", selectedExportEpisodes.join(","));
      const response = await fetch("/api/export?" + params.toString());
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Could not export this project."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = (project?.title || "project").replace(/[^a-z0-9.-]+/gi, "-") + "-export.zip"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not export this project."); }
  }

  async function exportText(scope: "scene" | "episode", id: string) {
    try {
      const params = new URLSearchParams({ [scope + "Id"]: id, format: exportFormat, layout: exportLayout, author: exportAuthor, titlePage: String(exportTitlePage), pageBreaks: String(exportScenePageBreaks) });
      if (scope === "episode" && selectedExportScenes.length) params.set("sceneIds", selectedExportScenes.join(","));
      const response = await fetch("/api/export?" + params.toString());
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Could not export this script."); }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/i)?.[1] || ("script-" + scope + "." + exportFormat);
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not export this script."); }
  }

  async function toggleSceneReference(kind: "characters" | "locations", itemId: string, checked: boolean) {
    if (!currentScene) return;
    const previous = kind === "characters" ? currentScene.characterIds || [] : currentScene.locationIds || [];
    const next = checked ? [...new Set([...previous, itemId])] : previous.filter((id) => id !== itemId);
    const response = await fetch(`/api/scenes/${currentScene._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(kind === "characters" ? { characterIds: next } : { locationIds: next }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not update scene references."); return; }
    setScenes((current) => current.map((scene) => scene._id === currentScene._id ? { ...scene, ...data } : scene)); setError("");
  }

  if (!project && !error) return <main className="workspace-loading"><div className="loading-mark"><BookOpen size={22} /></div><p>Opening your story…</p></main>;

  return (
    <main className="story-workspace">
      <header className="story-topbar">
        <Link href="/" className="back-link"><ArrowLeft size={17} /><span>All projects</span></Link>
        <div className="story-breadcrumb"><span>{project?.title || "Story workspace"}</span><span>/</span><strong>Writing room</strong></div>
        <div className="save-indicator"><span className={saving ? "save-dot busy" : "save-dot"} />{saveState}</div>
      </header>
      <div className="story-layout">
        <aside className="story-outline">
          <div className="outline-header"><div><span className="outline-kicker">STORY STRUCTURE</span><h1>{project?.title || "Your story"}</h1></div><button type="button" className="project-export-button" onClick={exportProject} title="Export project ZIP" aria-label="Export project ZIP"><Download size={15} /></button></div>
          <div className="project-export-options"><strong>Project export</strong><span>Select episodes below, or leave all unchecked to export every episode.</span></div>
          <p className="outline-description">{project?.description || "Every scene is another piece of your world."}</p>
          <div className="outline-section-title"><span>EPISODES</span><button aria-label="Add episode" onClick={() => setShowEpisodeInput((value) => !value)}><Plus size={16} /></button></div>
          {showEpisodeInput && <form className="inline-create-form" onSubmit={addEpisode}><input autoFocus value={newEpisodeTitle} onChange={(e) => setNewEpisodeTitle(e.target.value)} placeholder="Episode title" maxLength={120} required /><button type="submit" aria-label="Save episode"><Check size={15} /></button></form>}
          {!episodes.length && <div className="outline-empty">No episodes yet. Add the first chapter of your story.</div>}
          {episodes.map((episode, index) => {
            const episodeScenes = scenes.filter((scene) => scene.episodeId === episode._id);
            return <div className="episode-group" key={episode._id}>
              <div className="episode-heading"><label className="export-scene-check" title="Include this episode in project export"><input type="checkbox" checked={selectedExportEpisodes.includes(episode._id)} onChange={(event) => setSelectedExportEpisodes((current) => event.target.checked ? [...current, episode._id] : current.filter((id) => id !== episode._id))} aria-label={"Include " + episode.title + " in project export"} /></label><span className="episode-number">{String(index + 1).padStart(2, "0")}</span><span className="episode-heading-title">{episode.title}</span><div className="episode-management-actions"><button type="button" className="episode-manage-button" disabled={index === 0} title="Move episode up" aria-label={"Move " + episode.title + " up"} onClick={() => moveEpisode(episode._id, -1)}><ArrowUp size={12} /></button><button type="button" className="episode-manage-button" disabled={index === episodes.length - 1} title="Move episode down" aria-label={"Move " + episode.title + " down"} onClick={() => moveEpisode(episode._id, 1)}><ArrowDown size={12} /></button><button type="button" className="episode-manage-button" title="Rename episode" aria-label={"Rename " + episode.title} onClick={() => renameEpisode(episode)}><Pencil size={12} /></button><button type="button" className="episode-manage-button episode-delete-button" title="Delete episode and its scenes" aria-label={"Delete " + episode.title} onClick={() => deleteEpisode(episode)}><Trash2 size={12} /></button></div><button type="button" className="episode-export-button" title={"Export " + episode.title + " as " + exportFormat.toUpperCase()} aria-label={"Export " + episode.title + " as " + exportFormat.toUpperCase()} onClick={() => exportText("episode", episode._id)}><Download size={13} /></button><ChevronDown size={14} /></div>
              {episodeScenes.map((scene, sceneIndex) => <div className="scene-outline-row" key={scene._id}><label className="export-scene-check" title="Include this scene in episode export"><input type="checkbox" checked={selectedExportScenes.includes(scene._id)} onChange={(event) => setSelectedExportScenes((current) => event.target.checked ? [...current, scene._id] : current.filter((id) => id !== scene._id))} aria-label={"Include " + scene.title + " in episode export"} /></label><button className={`scene-link ${selectedScene === scene._id ? "selected" : ""}`} onClick={() => selectScene(scene)}><span className="scene-bullet" /><span>{scene.title}</span><small>{String(sceneIndex + 1).padStart(2, "0")}</small></button><div className="scene-management-actions"><button type="button" className="episode-manage-button" disabled={sceneIndex === 0} title="Move scene up" aria-label={"Move " + scene.title + " up"} onClick={() => moveScene(scene._id, -1)}><ArrowUp size={11} /></button><button type="button" className="episode-manage-button" disabled={sceneIndex === episodeScenes.length - 1} title="Move scene down" aria-label={"Move " + scene.title + " down"} onClick={() => moveScene(scene._id, 1)}><ArrowDown size={11} /></button><button type="button" className="episode-manage-button" title="Rename scene" aria-label={"Rename " + scene.title} onClick={() => renameScene(scene)}><Pencil size={11} /></button><button type="button" className="episode-manage-button episode-delete-button" title="Delete scene" aria-label={"Delete " + scene.title} onClick={() => deleteScene(scene)}><Trash2 size={11} /></button></div></div>)}
            </div>;
          })}
          <button className="outline-add-scene" onClick={() => { setSceneTargetEpisodeId((current) => current || episodes[0]?._id || ""); setShowSceneInput((value) => !value); }} disabled={!episodes.length}><Plus size={15} /> Add scene</button>
          {showSceneInput && <form className="inline-create-form scene-create-form" onSubmit={addScene}><select aria-label="Episode for new scene" value={sceneTargetEpisodeId} onChange={(e) => setSceneTargetEpisodeId(e.target.value)} required>{episodes.map((episode) => <option key={episode._id} value={episode._id}>{episode.title}</option>)}</select><input autoFocus value={newSceneTitle} onChange={(e) => setNewSceneTitle(e.target.value)} placeholder="Scene title" maxLength={120} required /><button type="submit" aria-label="Save scene"><Check size={15} /></button></form>}
          <div className="outline-tools"><button onClick={() => setActiveLibrary("characters")}><UsersRound size={16} /> Characters <span>{characters.length}</span></button><button onClick={() => setActiveLibrary("locations")}><MapPin size={16} /> Locations <span>{locations.length}</span></button><button onClick={() => setActiveLibrary("creatures")}><Sparkles size={16} /> Creatures <span>{creatures.length}</span></button></div>
        </aside>

        <section className="writing-room">
          {error && <div className="workspace-error" role="status">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
          {currentScene ? <>
            <div className="editor-topline"><div><span className="editor-label">SCENE EDITOR</span><span className="editor-separator">·</span><span className="editor-time"><Clock3 size={13} /> Autosave on</span></div><div className="editor-actions"><VersionHistory projectId={projectId} entityType="scene" entityId={currentScene._id} /><label className="export-format-control"><span>Layout</span><select aria-label="Export layout" value={exportLayout} onChange={(event) => setExportLayout(event.target.value as "readable" | "screenplay")}><option value="readable">Readable</option><option value="screenplay">Screenplay</option></select></label><label className="export-format-control"><span>Author</span><input className="export-author-input" aria-label="Author name for title page" placeholder="Optional" value={exportAuthor} onChange={(event) => setExportAuthor(event.target.value)} /></label><label className="export-option-check"><input type="checkbox" checked={exportTitlePage} onChange={(event) => setExportTitlePage(event.target.checked)} /> Title page</label><label className="export-option-check"><input type="checkbox" checked={exportScenePageBreaks} onChange={(event) => setExportScenePageBreaks(event.target.checked)} /> Scene page breaks</label><label className="export-format-control"><span>Format</span><select aria-label="Export format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value as "txt" | "pdf" | "docx")}><option value="txt">TXT</option><option value="pdf">PDF</option><option value="docx">DOCX</option></select></label><button type="button" className="export-text-button" onClick={() => exportText("scene", currentScene._id)}><Download size={15} /> Export Scene</button><button className="save-now" onClick={() => saveScene(currentScene._id, sceneTitle, draft)} disabled={saving}><Save size={15} /> Save</button></div></div>
            <input className="scene-title-input" aria-label="Scene title" value={sceneTitle} maxLength={120} onChange={(e) => { setSceneTitle(e.target.value); setSaveState("Unsaved changes"); if (timer.current) clearTimeout(timer.current); const value = e.target.value; if (currentScene) timer.current = setTimeout(() => saveScene(currentScene._id, value, draft), 800); }} />
            <section className="scene-reference-panel" aria-label="Scene references">
              <div className="scene-reference-group"><strong><UsersRound size={14} /> Characters</strong>
                {characters.length ? <div className="scene-reference-options">{characters.map((character) => <label key={character._id}><input type="checkbox" checked={(currentScene.characterIds || []).includes(character._id)} onChange={(event) => toggleSceneReference("characters", character._id, event.target.checked)} /><span>{character.name}</span></label>)}</div> : <p>No characters yet. <button type="button" onClick={() => setActiveLibrary("characters")}>Create one</button></p>}
              </div>
              <div className="scene-reference-group"><strong><MapPin size={14} /> Locations</strong>
                {locations.length ? <div className="scene-reference-options">{locations.map((location) => <label key={location._id}><input type="checkbox" checked={(currentScene.locationIds || []).includes(location._id)} onChange={(event) => toggleSceneReference("locations", location._id, event.target.checked)} /><span>{location.name}</span></label>)}</div> : <p>No locations yet. <button type="button" onClick={() => setActiveLibrary("locations")}>Create one</button></p>}
              </div>
            </section>
            <div className="editor-format-toolbar"><span className="format-chip">Aa</span><span className="format-toolbar-note">Insert linked characters, locations, and creatures into your scene</span><span className="editor-word-count">{draft.replace(/<[^>]*>/g," ").trim()?draft.replace(/<[^>]*>/g," ").trim().split(/\s+/).length:0} words</span></div>
<SceneContentEditor key={currentScene._id} value={draft} characters={characters} locations={locations} creatures={creatures} onChange={changeDraft}/>
<footer className="editor-footer"><span>Linked mentions · Click a name to view saved details</span><span>{draft.replace(/<[^>]*>/g,"").length.toLocaleString()} characters</span></footer>
          </> : <div className="editor-empty"><div className="editor-empty-icon"><FilePlus2 size={25} /></div><h2>A blank page is full of possibility.</h2><p>Create an episode and a scene to start writing your story.</p>{!episodes.length ? <button className="story-primary-button" onClick={() => setShowEpisodeInput(true)}><Plus size={16} /> Add first episode</button> : <button className="story-primary-button" onClick={() => setShowSceneInput(true)}><Plus size={16} /> Add first scene</button>}</div>}
        </section>
      </div>
      {activeLibrary && <WorldLibrary projectId={projectId} kind={activeLibrary} onClose={() => setActiveLibrary(null)} items={activeLibrary === "characters" ? characters : activeLibrary === "locations" ? locations : creatures} setItems={activeLibrary === "characters" ? setCharacters : activeLibrary === "locations" ? setLocations : setCreatures} setScenes={setScenes} />}
    </main>
  );
}