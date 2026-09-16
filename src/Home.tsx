"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import siteContentData from "../content/site-content.json";
import VisitorStats from "./VisitorStats";
import PublicationLibrary, { SelectedPublications } from "./PublicationLibrary";
import { scrollToId, topics, type Publication } from "./research";

type Education = {
  period: string;
  institution: string;
  degree: string;
  detail: string;
};

type SiteContent = {
  profile: {
    name: string;
    title: string;
    affiliation: string;
    location: string;
    email: string;
    emailSecondary: string;
    status: string;
    statement: string;
  };
  links: {
    scholar: string;
    orcid: string;
    legacySite: string;
    researchGate: string;
    bilibili: string;
  };
  publications: Publication[];
  updates: Array<{ date: string; year: string; text: string; kind: string; href?: string }>;
  focusAreas: Array<{ index: string; title: string; en: string; text: string }>;
  education: Education[];
  projects: Array<{ period: string; title: string; meta: string }>;
  awards: Array<{ year: string; title: string }>;
};

type OrcidWorkSummary = {
  "put-code": number;
  title?: {
    title?: { value?: string };
    "translated-title"?: { content?: string; "language-code"?: string };
  };
  "publication-date"?: {
    year?: { value?: string };
    month?: { value?: string };
    day?: { value?: string };
  };
  "journal-title"?: { value?: string };
  "external-ids"?: {
    "external-id"?: Array<{
      "external-id-type"?: string;
      "external-id-value"?: string;
    }>;
  };
};

type LiveWork = {
  id: string;
  title: string;
  publicationDate: string;
  doi?: string;
  venue: string;
  citedBy?: number;
};

type OpenAlexWork = {
  publication_date?: string;
  cited_by_count?: number;
  primary_location?: { source?: { display_name?: string } };
};

const {
  profile: PROFILE,
  links: LINKS,
  publications,
  updates,
  focusAreas,
  education,
  projects,
  awards,
} = siteContentData as SiteContent;

const fallbackLiveWorks: LiveWork[] = publications
  .filter((paper) => paper.doi)
  .slice(0, 4)
  .map((paper) => ({
    id: String(paper.id),
    title: paper.title,
    publicationDate: String(paper.year),
    doi: paper.doi,
    venue: paper.venue.split(",")[0],
  }));

// Prefer curated English text when an external record contains a Chinese title.
// Keep the original record linked; do not invent translations for new outputs.
function englishFeedText(value: string | undefined, fallback: string) {
  const text = value?.trim();
  return text && !/\p{Script=Han}/u.test(text) ? text : fallback;
}

function readOrcidWorks(data: { group?: Array<{ "work-summary"?: OrcidWorkSummary[] }> }) {
  const summaries = data.group?.flatMap((group) => group["work-summary"] ?? []) ?? [];
  const unique = new Map<string, LiveWork>();

  for (const work of summaries) {
    const title = work.title?.title?.value?.trim();
    const year = work["publication-date"]?.year?.value;
    if (!title || !year) continue;

    const doi = work["external-ids"]?.["external-id"]
      ?.find((item) => item["external-id-type"]?.toLowerCase() === "doi")
      ?.["external-id-value"]
      ?.toLowerCase();
    const month = work["publication-date"]?.month?.value?.padStart(2, "0");
    const day = month ? work["publication-date"]?.day?.value?.padStart(2, "0") : undefined;
    const publicationDate = [year, month, day].filter(Boolean).join("-");
    const key = doi || title.toLowerCase();
    const local = doi ? publications.find((paper) => paper.doi?.toLowerCase() === doi) : undefined;
    const translated = work.title?.["translated-title"];
    const englishTitle = translated?.["language-code"]?.startsWith("en") ? translated.content : undefined;

    if (!unique.has(key)) {
      unique.set(key, {
        id: String(work["put-code"]),
        title: englishFeedText(englishTitle || title, local?.title || `Research output · ORCID record ${work["put-code"]}`),
        publicationDate,
        doi,
        venue: englishFeedText(work["journal-title"]?.value, local?.venue.split(",")[0] || "ORCID WORKS"),
      });
    }
  }

  return [...unique.values()]
    .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
    .slice(0, 4);
}

function LiveResearchFeed() {
  const [works, setWorks] = useState<LiveWork[]>(fallbackLiveWorks);
  const [status, setStatus] = useState<"syncing" | "live" | "fallback" | "stale">("syncing");
  const [syncedAt, setSyncedAt] = useState<string>("—");
  const hasSynced = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  const sync = useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    setStatus("syncing");
    try {
      const response = await fetch("https://pub.orcid.org/v3.0/0000-0002-5086-0768/works", {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("ORCID feed unavailable");

      const latest = readOrcidWorks(await response.json());
      const enriched = await Promise.all(
        latest.map(async (work) => {
          if (!work.doi) return work;
          try {
            const openAlexResponse = await fetch(
              `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(work.doi)}`,
              { cache: "no-store", signal: controller.signal },
            );
            if (!openAlexResponse.ok) return work;
            const openAlex = (await openAlexResponse.json()) as OpenAlexWork;
            return {
              ...work,
              publicationDate: openAlex.publication_date || work.publicationDate,
              venue: englishFeedText(openAlex.primary_location?.source?.display_name, work.venue),
              citedBy: openAlex.cited_by_count,
            };
          } catch {
            return work;
          }
        }),
      );

      if (!enriched.length) throw new Error("No public works found");
      if (!mounted.current) return;
      setWorks(enriched);
      setStatus("live");
      hasSynced.current = true;
      setSyncedAt(
        new Intl.DateTimeFormat("en-GB", {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    } catch {
      if (mounted.current) setStatus(hasSynced.current ? "stale" : "fallback");
    } finally {
      window.clearTimeout(timeout);
      pending.current = null;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const initialSync = window.setTimeout(() => void sync(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void sync(); }, 10 * 60 * 1000);
    return () => {
      mounted.current = false;
      pending.current?.abort();
      window.clearTimeout(initialSync);
      window.clearInterval(timer);
    };
  }, [sync]);

  return (
    <div className="live-panel">
      <div className="live-head">
        <div>
          <p className="eyebrow">CONNECTED SCHOLARLY PROFILE</p>
          <h3>Latest research & citations</h3>
        </div>
        <button className="sync-button" onClick={() => void sync()} disabled={status === "syncing"}>
          <span className={`pulse ${status}`} aria-hidden="true" />
          {status === "syncing" ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="feed-list" aria-live="polite">
        {works.map((work, index) => (
          <article className="feed-item" key={`${work.id}-${work.doi || work.title}`}>
            <span className="feed-number">0{index + 1}</span>
            <div>
              <a
                href={work.doi ? `https://doi.org/${work.doi}` : LINKS.orcid}
                target="_blank"
                rel="noreferrer"
              >
                {work.title}
              </a>
              <span>
                {work.publicationDate} · {work.venue}
                {typeof work.citedBy === "number" ? ` · OpenAlex citations: ${work.citedBy}` : ""}
              </span>
            </div>
            <span className="north-east" aria-hidden="true">↗</span>
          </article>
        ))}
      </div>
      <div className="live-foot">
        <span>Sources: ORCID + OpenAlex · <a href={LINKS.scholar} target="_blank" rel="noreferrer">Google Scholar ↗</a></span>
        <span role="status">{status === "fallback" ? "Service unavailable · Showing curated records" : status === "stale" ? `Refresh unavailable · Last successful sync: ${syncedAt}` : hasSynced.current ? `Last successful sync: ${syncedAt}` : "Connecting to public research records…"}</span>
      </div>
      <p className="feed-note">Checks every 10 minutes while this page is open and visible. Publication status, news, and the full research library are maintained separately.</p>
    </div>
  );
}

function AcademicPath() {
  return (
    <section id="experience" className="section path-section">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow">ACADEMIC PATH</p>
          <h2>Education & research experience</h2>
        </div>
        <p>From bridge engineering and impact dynamics to nonlinear vibration control, with collaborative research at Tongji University and the University of Toronto.</p>
      </div>
      <div className="career-grid">
        <div className="education-list">
          {education.map((item: Education) => (
            <article key={`${item.period}-${item.institution}`}>
              <time>{item.period}</time>
              <div>
                <h3>{item.institution}</h3>
                <p>{item.degree}</p>
                <span>{item.detail}</span>
              </div>
            </article>
          ))}
        </div>
        <div className="project-column">
          <p className="eyebrow">FUNDED RESEARCH</p>
          <div className="project-list">
            {projects.map((project) => (
              <article key={project.title}>
                <span>{project.period}</span>
                <h3>{project.title}</h3>
                <p>{project.meta}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
      <div id="awards" className="awards-block">
        <p className="eyebrow">SELECTED HONOURS</p>
        <div className="awards-grid">
          {awards.slice(0, 6).map((award) => (
            <article key={`${award.year}-${award.title}`}>
              <span>{award.year}</span>
              <p>{award.title}</p>
            </article>
          ))}
        </div>
        <details className="more-honours"><summary>View earlier honours</summary><div className="awards-grid">{awards.slice(6).map(award => <article key={`${award.year}-${award.title}`}><span>{award.year}</span><p>{award.title}</p></article>)}</div></details>
      </div>
    </section>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [emailCopied, setEmailCopied] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [activeSection, setActiveSection] = useState("top");
  const [topicRequest, setTopicRequest] = useState({ topic: "All", key: 0 });
  const headerRef = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const emailTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyPreference = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem("rx-theme"); } catch { /* Storage may be disabled. */ }
      const preferred = saved === "light" || saved === "dark" ? saved : media.matches ? "dark" : "light";
      setTheme(preferred);
      document.documentElement.dataset.theme = preferred;
    };
    applyPreference();
    media.addEventListener("change", applyPreference);
    return () => { media.removeEventListener("change", applyPreference); window.clearTimeout(emailTimer.current); };
  }, []);

  useEffect(() => {
    let frame = 0;
    const updateSection = () => {
      frame = 0;
      const ids = ["top", "selected", "about", "research", "publications", "experience", "news", "contact"];
      let current = "top";
      for (const id of ids) { if ((document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= 150) current = id; }
      setActiveSection(current === "selected" ? "publications" : current);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(updateSection); };
    updateSection();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const focusOutside = (event: FocusEvent) => { if (!headerRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", focusOutside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); document.removeEventListener("focusin", focusOutside); };
  }, [menuOpen]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("rx-theme", next); } catch { /* Theme still works without persistence. */ }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(PROFILE.email);
      setEmailCopied(true);
      setEmailError(false);
      window.clearTimeout(emailTimer.current);
      emailTimer.current = window.setTimeout(() => setEmailCopied(false), 2500);
    } catch { setEmailError(true); }
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <main>
      <a href="#about" className="skip-link">Skip to content</a>
      <header className="site-header" ref={headerRef}>
        <a href="#top" className="wordmark" onClick={closeMenu} aria-label="Back to home">
          RX<span>·</span>
        </a>
        <nav id="main-navigation" className={menuOpen ? "open" : ""} aria-label="Main navigation">
          {[["about", "About"], ["research", "Research"], ["publications", "Publications"], ["experience", "Experience"], ["news", "News"], ["contact", "Contact"]].map(([id, label]) => <a key={id} href={`#${id}`} onClick={closeMenu} aria-current={activeSection === id ? "location" : undefined}>{label}</a>)}
        </nav>
        <div className="header-actions">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? "◐" : "◑"}
          </button>
          <button
            className="menu-toggle"
            ref={menuButton}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <section id="top" className="hero">
        <div className="hero-kicker">
          <span className="status-dot" aria-hidden="true" />
          {PROFILE.status} · 2026
        </div>
        <div className="hero-grid">
          <div className="hero-title-wrap">
            <p className="hero-prefix">Academic profile</p>
            <h1><span>RUIHONG</span><span className="hero-last-name">XIE</span></h1>
          </div>
          <div className="hero-intro">
            <p className="role">{PROFILE.title}</p>
            <p className="hero-statement">{PROFILE.statement}</p>
            <div className="hero-actions"><a href="#selected" className="primary-link">Selected publications <span aria-hidden="true">↓</span></a><a href="./cv.html" className="secondary-link">View CV <span aria-hidden="true">↗</span></a><a href={`mailto:${PROFILE.email}`} className="secondary-link">Contact <span aria-hidden="true">↗</span></a></div>
          </div>
        </div>
        <div className="hero-footer">
          <span>{PROFILE.affiliation}</span>
          <span>{PROFILE.location}</span>
          <span>STRUCTURES · WIND · CONTROL</span>
        </div>
      </section>

      <SelectedPublications />

      <section id="about" className="section about-section">
        <div className="about-label">
          <p className="eyebrow">ABOUT</p>
        </div>
        <div className="about-copy">
          <p className="lead-copy">
            My research connects <span>bridge wind engineering, nonlinear dynamics, and structural resilience</span> to keep long-span bridges safe, stable, and efficient.
          </p>
          <div className="about-columns">
            <p>I graduated with a PhD in Civil Engineering from Tongji University on 20 August 2026. During my doctoral studies, I conducted visiting research at the University of Toronto. My work focuses on the theory, design, and experimental validation of nonlinear energy sink inerters for controlling vortex-induced vibrations, buffeting, and flutter in bridges.</p>
            <p>Previously, I studied bridge impact dynamics and composite protective structures at Hunan University. I now explore coordinated vibration control and energy harvesting, bringing structural safety, device efficiency, and practical implementation into a common design framework.</p>
          </div>
          <div className="profile-links">
            <a href={LINKS.scholar} target="_blank" rel="noreferrer">Google Scholar ↗</a>
            <a href={LINKS.orcid} target="_blank" rel="noreferrer">ORCID ↗</a>
            <a href={LINKS.researchGate} target="_blank" rel="noreferrer">ResearchGate ↗</a>
            <a href="https://github.com/xieruihong" target="_blank" rel="noreferrer">GitHub ↗</a>
          </div>
        </div>
      </section>

      <section id="research" className="section research-section">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow">RESEARCH AGENDA</p>
            <h2>Research interests</h2>
          </div>
          <p>From wind-induced response mechanisms and control devices to real-time hybrid testing and structural protection, I work towards safer, lighter, and more sustainable structures.</p>
        </div>
        <div className="focus-grid">
          {focusAreas.map((area, index) => (
            <article className="focus-card" key={area.index}>
              <div className="focus-top">
                <span>{area.index}</span>
                <span className="focus-mark" aria-hidden="true" />
              </div>
              <h3>{area.title}</h3>
              <p className="focus-text">{area.text}</p>
              <button aria-label={`View publications about ${area.title}`} onClick={() => { setTopicRequest(current => ({ topic: topics[index].id, key: current.key + 1 })); window.history.replaceState(null, "", "#publications"); scrollToId("publications"); }}>
                View related work <span aria-hidden="true">↓</span>
              </button>
            </article>
          ))}
        </div>
        <LiveResearchFeed />
      </section>

      <PublicationLibrary request={topicRequest} />
      <AcademicPath />

      <section id="news" className="section updates-section">
        <div className="section-heading split-heading">
          <div>
            <p className="eyebrow">NEWS & MILESTONES</p>
            <h2>Research updates</h2>
          </div>
          <span className="issue-number">PROFILE UPDATED · 2026</span>
        </div>
        <div className="updates-list">
          {updates.map((update) => (
            <article key={`${update.year}-${update.date}-${update.kind}`}>
              <time><strong>{update.date}</strong><span>{update.year}</span></time>
              <span className="update-kind">{update.kind}</span>
              <p>{update.href ? <a href={update.href}>{update.text} <span aria-hidden="true">→</span></a> : update.text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer id="contact" className="site-footer">
        <div className="footer-top">
          <p className="eyebrow">RESEARCH COLLABORATION</p>
          <h2>Let's tackle the challenges of <em>wind & vibration.</em></h2>
          <button className="email-button" onClick={() => void copyEmail()}>
            {emailCopied ? "Email copied ✓" : "Copy email"}<span>↗</span>
          </button>
          <p role="status" className="email-feedback">{emailError ? `Copy unavailable. Select the email address below, or use its email link.` : emailCopied ? "Email address copied." : ""}</p>
        </div>
        <div className="contact-lines">
          <a href={`mailto:${PROFILE.email}`}>{PROFILE.email}</a>
          <a href={`mailto:${PROFILE.emailSecondary}`}>{PROFILE.emailSecondary}</a>
        </div>
        <div className="footer-bottom">
          <div><strong>{PROFILE.name}</strong><span>BRIDGE · WIND · VIBRATION</span></div>
          <p>© 2026 · ACADEMIC PROFILE</p>
          <div className="social-links">
            <a href={LINKS.scholar} target="_blank" rel="noreferrer">SCHOLAR</a>
            <a href={LINKS.orcid} target="_blank" rel="noreferrer">ORCID</a>
            <a href="#top">TOP ↑</a>
          </div>
        </div>
        <VisitorStats />
      </footer>
    </main>
  );
}
