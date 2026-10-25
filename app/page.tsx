"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen, ChevronDown, CircleHelp, Clapperboard, Clock3, Compass, FilePlus2,
  FolderOpen, MapPin, Menu, MoreHorizontal, Plus, Search, Settings2, Sparkles,
  UsersRound, X, ArrowUpRight, PenLine, LibraryBig
} from "lucide-react";

type Project = {
  _id: string;
  title: string;
  description?: string;
  updatedAt?: string;
  episodeCount?: number;
  sceneCount?: number;
  color?: string;
};

const initialProjects: Project[] = [
  { _id: "sample-1", title: "The Lost Kingdom", description: "Fantasy · A forgotten world begins to awaken.", updatedAt: "Edited today", episodeCount: 4, sceneCount: 18, color: "lavender" },
  { _id: "sample-2", title: "Between Two Worlds", description: "Drama · One decision changes everything.", updatedAt: "Edited yesterday", episodeCount: 2, sceneCount: 9, color: "peach" },
  { _id: "sample-3", title: "Neon Dharma", description: "Sci-fi · Ancient wisdom in a future city.", updatedAt: "Edited 3 days ago", episodeCount: 1, sceneCount: 6, color: "mint" },
];

const navItems = [
  { label: "Overview", icon: Compass },
  { label: "My projects", icon: FolderOpen },
  { label: "Characters", icon: UsersRound },
  { label: "Locations", icon: MapPin },
];

export default function Home() {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("Overview");
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data.user?.role !== "writer") router.replace("/login");
      })
      .catch(() => { if (!cancelled) router.replace("/login"); });
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then((response) => {
        if (!response.ok) throw new Error("Projects API unavailable");
        return response.json();
      })
      .then((items: Project[]) => {
        if (!cancelled && Array.isArray(items)) setProjects(items);
      })
      .catch(() => {
        // Keep the sample preview available when MongoDB has not been configured yet.
      });
    return () => { cancelled = true; };
  }, []);

  const filteredProjects = useMemo(
    () => projects.filter((p) => (p.title + " " + (p.description || "")).toLowerCase().includes(query.toLowerCase())),
    [projects, query]
  );

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), description: newDescription.trim() }),
      });
      if (!response.ok) throw new Error("API unavailable");
      const project = await response.json();
      setProjects((current) => [project, ...current]);
      setNotice("Project created and saved to MongoDB.");
    } catch {
      const localProject: Project = {
        _id: crypto.randomUUID(),
        title: newTitle.trim(),
        description: newDescription.trim() || "A new story waiting to be written.",
        updatedAt: "Just created",
        episodeCount: 0,
        sceneCount: 0,
        color: ["lavender", "peach", "mint"][projects.length % 3],
      };
      setProjects((current) => [localProject, ...current]);
      setNotice("Preview project created locally. Connect MongoDB to persist projects.");
    } finally {
      setSaving(false);
      setShowCreate(false);
      setNewTitle("");
      setNewDescription("");
      window.setTimeout(() => setNotice(""), 4500);
    }
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><Clapperboard size={21} strokeWidth={2.2} /></div>
          <span className="brand-name">scriptwriter<span className="brand-period">.</span></span>
          <button className="icon-button mobile-close" aria-label="Close menu" onClick={() => setMobileNav(false)}><X size={19} /></button>
        </div>

        <button className="workspace-switch">
          <div className="workspace-avatar">Z</div>
          <div className="workspace-copy"><strong>My workspace</strong><span>Free plan</span></div>
          <ChevronDown size={16} className="muted-icon" />
        </button>

        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeNav === label ? "active" : ""}`} onClick={() => { setActiveNav(label); setMobileNav(false); }}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === "My projects" && <span className="nav-count">{projects.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-tip">
          <div className="tip-icon"><Sparkles size={17} /></div>
          <strong>Your next story starts here.</strong>
          <p>Build your world, meet your characters, then let the story unfold.</p>
          <button onClick={() => setShowCreate(true)}>Create a project <ArrowUpRight size={14} /></button>
        </div>

        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setNotice("Settings will be available as the workspace grows.")}><Settings2 size={18} /><span>Settings</span></button>
          <button className="nav-item" onClick={() => setNotice("Help center is coming soon.")}><CircleHelp size={18} /><span>Help & feedback</span></button>
          <div className="profile-row"><div className="profile-avatar">Z</div><div className="profile-copy"><strong>Zasha</strong><span>Writer workspace</span></div><MoreHorizontal size={19} className="muted-icon" /></div>
        </div>
      </aside>

      {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}

      <section className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <button className="help-button" onClick={() => setNotice("Your writing guide is coming soon.")}><CircleHelp size={17} /><span>Help</span></button>
            <div className="top-avatar">Z</div>
          </div>
        </header>

        <div className="page-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> YOUR CREATIVE SPACE</div>
              <h1>Every great story<br className="mobile-title-break" /> starts somewhere<span className="title-dot">.</span></h1>
              <p className="welcome-subtitle">A little space for the worlds only you can imagine.</p>
            </div>
            <button className="primary-button create-main" onClick={() => setShowCreate(true)}><Plus size={18} /> New project</button>
          </div>

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon purple"><LibraryBig size={19} /></div><div><span className="stat-label">STORIES IN PROGRESS</span><strong>{projects.length.toString().padStart(2, "0")}</strong></div><span className="stat-foot">your worlds</span></div>
            <div className="stat-card"><div className="stat-icon orange"><UsersRound size={19} /></div><div><span className="stat-label">CHARACTERS</span><strong>12</strong></div><span className="stat-foot">personalities</span></div>
            <div className="stat-card"><div className="stat-icon green"><MapPin size={19} /></div><div><span className="stat-label">LOCATIONS</span><strong>08</strong></div><span className="stat-foot">places to go</span></div>
          </div>

          <div className="section-heading">
            <div><h2>{activeNav === "Overview" ? "Your projects" : activeNav}</h2><p>{activeNav === "Overview" ? "Pick up where your imagination left off." : "Your creative library, all in one place."}</p></div>
            <div className="project-controls">
              <label className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a story..." aria-label="Search projects" />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</label>
              <button className="filter-button" aria-label="Project options" onClick={() => setNotice("Project filters are coming soon.")}><span>Recent</span><ChevronDown size={15} /></button>
            </div>
          </div>

          {activeNav === "Characters" || activeNav === "Locations" ? (
            <div className="empty-library">
              <div className="empty-art">{activeNav === "Characters" ? <UsersRound size={28} /> : <MapPin size={28} />}</div>
              <h3>Your {activeNav.toLowerCase()} will live here</h3>
              <p>Create a project first, then build a cast of characters and a world full of memorable places.</p>
              <button className="primary-button" onClick={() => setActiveNav("My projects")}>Explore projects <ArrowUpRight size={16} /></button>
            </div>
          ) : (
            <div className="project-grid">
              {filteredProjects.map((project, index) => (
                <article className="project-card" key={project._id}>
                  <div className={`project-art art-${project.color || ["lavender", "peach", "mint"][index % 3]}`}>
                    <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
                    <div className="art-glyph">{index % 3 === 0 ? <Compass size={31} strokeWidth={1.25} /> : index % 3 === 1 ? <BookOpen size={31} strokeWidth={1.25} /> : <Sparkles size={31} strokeWidth={1.25} />}</div>
                    <span className="project-kind">{index % 2 === 0 ? "STORY UNIVERSE" : "ORIGINAL SCRIPT"}</span>
                    <button className="card-more" aria-label={`Options for ${project.title}`} onClick={() => setNotice("Project actions will be available soon.")}><MoreHorizontal size={19} /></button>
                  </div>
                  <div className="project-card-body">
                    <div className="project-title-row"><h3>{project.title}</h3><span className="status-dot" title="In progress" /></div>
                    <p className="project-description">{project.description || "A new story waiting to be written."}</p>
                    <div className="project-meta"><span><BookOpen size={14} /> {project.episodeCount ?? 0} episodes</span><span><PenLine size={14} /> {project.sceneCount ?? 0} scenes</span></div>
                    <div className="project-card-footer"><span><Clock3 size={13} /> {project.updatedAt || "Recently updated"}</span><button onClick={() => { if (project._id.startsWith("sample-")) setNotice("Create a project to open its writing room."); else router.push(`/projects/${project._id}`); }}>Open story <ArrowUpRight size={14} /></button></div>
                  </div>
                </article>
              ))}
              <button className="new-project-card" onClick={() => setShowCreate(true)}><span className="new-project-icon"><Plus size={22} /></span><strong>Start a new story</strong><span>Give that idea a place to grow.</span></button>
            </div>
          )}

          <div className="bottom-note"><div className="note-sparkle"><Sparkles size={16} /></div><p><strong>Make room for the unexpected.</strong> The best stories rarely go exactly as planned.</p><span>✳</span></div>
        </div>
      </section>

      {notice && <div className="toast" role="status"><span className="toast-check">✓</span>{notice}<button aria-label="Dismiss" onClick={() => setNotice("")}><X size={15} /></button></div>}

      {showCreate && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
        <form className="create-modal" onSubmit={createProject}>
          <button type="button" className="modal-close icon-button" aria-label="Close dialog" onClick={() => setShowCreate(false)}><X size={19} /></button>
          <div className="modal-mark"><FilePlus2 size={23} /></div>
          <div className="eyebrow">A NEW BEGINNING</div>
          <h2>Start your next story</h2>
          <p className="modal-description">Every universe starts with a name. You can fill in the details as your idea takes shape.</p>
          <label className="field-label" htmlFor="project-title">Story title</label>
          <input id="project-title" className="text-field" autoFocus required maxLength={100} placeholder="e.g. The Lost Kingdom" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <label className="field-label" htmlFor="project-description">A little about it <span>OPTIONAL</span></label>
          <textarea id="project-description" className="text-field text-area" maxLength={500} placeholder="A world, a character, a feeling..." value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          <button className="primary-button modal-submit" type="submit" disabled={saving}>{saving ? "Creating..." : <><Plus size={17} /> Create project</>}</button>
          <span className="modal-footnote">Your story. Your universe. Your rules.</span>
        </form>
      </div>}
    </main>
  );
}