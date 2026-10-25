"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Check, ChevronDown, Clock3, FilePlus2, MapPin, Plus, Save, UsersRound } from "lucide-react";

type Project = { _id: string; title: string; description?: string };
type Episode = { _id: string; title: string; order: number };
type Scene = { _id: string; episodeId: string; title: string; content: string; order: number };

export default function ProjectWorkspace() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [project, setProject] = useState<Project | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<string>("");
  const [draft, setDraft] = useState("");
  const [sceneTitle, setSceneTitle] = useState("");
  const [newEpisodeTitle, setNewEpisodeTitle] = useState("");
  const [newSceneTitle, setNewSceneTitle] = useState("");
  const [showEpisodeInput, setShowEpisodeInput] = useState(false);
  const [showSceneInput, setShowSceneInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("All changes saved");
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentScene = scenes.find((scene) => scene._id === selectedScene) ?? null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [projectResponse, episodeResponse] = await Promise.all([
          fetch(`/api/projects/${projectId}`),
          fetch(`/api/projects/${projectId}/episodes`),
        ]);
        if (!projectResponse.ok || !episodeResponse.ok) throw new Error("Could not load this story. Check the database connection.");
        const [projectData, episodeData] = await Promise.all([projectResponse.json(), episodeResponse.json()]);
        if (cancelled) return;
        setProject(projectData);
        setEpisodes(episodeData);
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
  }, [projectId]);

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

  async function addScene(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newSceneTitle.trim();
    if (!title || !episodes.length) return;
    const response = await fetch(`/api/episodes/${episodes[0]._id}/scenes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (!response.ok) { setError("Could not create scene."); return; }
    const scene = await response.json();
    setScenes((current) => [...current, scene]);
    selectScene(scene);
    setNewSceneTitle("");
    setShowSceneInput(false);
    setError("");
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
          <div className="outline-header"><div><span className="outline-kicker">STORY STRUCTURE</span><h1>{project?.title || "Your story"}</h1></div><BookOpen size={19} /></div>
          <p className="outline-description">{project?.description || "Every scene is another piece of your world."}</p>
          <div className="outline-section-title"><span>EPISODES</span><button aria-label="Add episode" onClick={() => setShowEpisodeInput((value) => !value)}><Plus size={16} /></button></div>
          {showEpisodeInput && <form className="inline-create-form" onSubmit={addEpisode}><input autoFocus value={newEpisodeTitle} onChange={(e) => setNewEpisodeTitle(e.target.value)} placeholder="Episode title" maxLength={120} required /><button type="submit" aria-label="Save episode"><Check size={15} /></button></form>}
          {!episodes.length && <div className="outline-empty">No episodes yet. Add the first chapter of your story.</div>}
          {episodes.map((episode, index) => {
            const episodeScenes = scenes.filter((scene) => scene.episodeId === episode._id);
            return <div className="episode-group" key={episode._id}>
              <div className="episode-heading"><span className="episode-number">{String(index + 1).padStart(2, "0")}</span><span>{episode.title}</span><ChevronDown size={14} /></div>
              {episodeScenes.map((scene, sceneIndex) => <button key={scene._id} className={`scene-link ${selectedScene === scene._id ? "selected" : ""}`} onClick={() => selectScene(scene)}><span className="scene-bullet" /><span>{scene.title}</span><small>{String(sceneIndex + 1).padStart(2, "0")}</small></button>)}
            </div>;
          })}
          <button className="outline-add-scene" onClick={() => setShowSceneInput((value) => !value)} disabled={!episodes.length}><Plus size={15} /> Add scene</button>
          {showSceneInput && <form className="inline-create-form" onSubmit={addScene}><input autoFocus value={newSceneTitle} onChange={(e) => setNewSceneTitle(e.target.value)} placeholder="Scene title" maxLength={120} required /><button type="submit" aria-label="Save scene"><Check size={15} /></button></form>}
          <div className="outline-tools"><button onClick={() => setError("Character library is the next feature being built.")}><UsersRound size={16} /> Characters <span>→</span></button><button onClick={() => setError("Location library is the next feature being built.")}><MapPin size={16} /> Locations <span>→</span></button></div>
        </aside>

        <section className="writing-room">
          {error && <div className="workspace-error" role="status">{error}<button onClick={() => setError("")}>Dismiss</button></div>}
          {currentScene ? <>
            <div className="editor-topline"><div><span className="editor-label">SCENE EDITOR</span><span className="editor-separator">·</span><span className="editor-time"><Clock3 size={13} /> Autosave on</span></div><button className="save-now" onClick={() => saveScene(currentScene._id, sceneTitle, draft)} disabled={saving}><Save size={15} /> Save</button></div>
            <input className="scene-title-input" aria-label="Scene title" value={sceneTitle} maxLength={120} onChange={(e) => { setSceneTitle(e.target.value); setSaveState("Unsaved changes"); if (timer.current) clearTimeout(timer.current); const value = e.target.value; if (currentScene) timer.current = setTimeout(() => saveScene(currentScene._id, value, draft), 800); }} />
            <div className="editor-format-toolbar"><span className="format-chip">Aa</span><span className="format-toolbar-note">A quiet place for your next scene</span><span className="editor-word-count">{draft.trim() ? draft.trim().split(/\s+/).length : 0} words</span></div>
            <textarea className="scene-editor" aria-label="Scene content" placeholder={"The scene begins…\n\nDescribe what we see, what the characters do, and what they say.\n\nYour story is yours to tell."} value={draft} onChange={(e) => changeDraft(e.target.value)} spellCheck />
            <footer className="editor-footer"><span>Plain text editor · Rich-text and character references are coming next</span><span>{draft.length.toLocaleString()} characters</span></footer>
          </> : <div className="editor-empty"><div className="editor-empty-icon"><FilePlus2 size={25} /></div><h2>A blank page is full of possibility.</h2><p>Create an episode and a scene to start writing your story.</p>{!episodes.length ? <button className="story-primary-button" onClick={() => setShowEpisodeInput(true)}><Plus size={16} /> Add first episode</button> : <button className="story-primary-button" onClick={() => setShowSceneInput(true)}><Plus size={16} /> Add first scene</button>}</div>}
        </section>
      </div>
    </main>
  );
}