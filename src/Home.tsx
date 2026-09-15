"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import siteContentData from "../content/site-content.json";

type Publication = {
  id: number;
  year: number;
  type: "Journal article" | "Under review" | "Conference" | "Patent";
  title: string;
  venue: string;
  authors: string;
  abstract: string;
  tags: string[];
  citation: string;
  doi?: string;
  featured?: boolean;
};

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
  updates: Array<{ date: string; year: string; text: string; kind: string }>;
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
    const month = work["publication-date"]?.month?.value?.padStart(2, "0") ?? "01";
    const day = work["publication-date"]?.day?.value?.padStart(2, "0") ?? "01";
    const publicationDate = `${year}-${month}-${day}`;
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
  const [status, setStatus] = useState<"syncing" | "live" | "fallback">("syncing");
  const [syncedAt, setSyncedAt] = useState<string>("—");

  const sync = useCallback(async () => {
    setStatus("syncing");
    try {
      const response = await fetch("https://pub.orcid.org/v3.0/0000-0002-5086-0768/works", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("ORCID feed unavailable");

      const latest = readOrcidWorks(await response.json());
      const enriched = await Promise.all(
        latest.map(async (work) => {
          if (!work.doi) return work;
          try {
            const openAlexResponse = await fetch(
              `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(work.doi)}`,
              { cache: "no-store" },
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
      setWorks(enriched);
      setStatus("live");
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
      setWorks(fallbackLiveWorks);
      setStatus("fallback");
      setSyncedAt("Local backup");
    }
  }, []);

  useEffect(() => {
    const initialSync = window.setTimeout(() => void sync(), 0);
    const timer = window.setInterval(() => void sync(), 10 * 60 * 1000);
    return () => {
      window.clearTimeout(initialSync);
      window.clearInterval(timer);
    };
  }, [sync]);

  return (
    <div className="live-panel">
      <div className="live-head">
        <div>
          <p className="eyebrow">LIVE SCHOLARLY PROFILE</p>
          <h3>Latest research & citations</h3>
        </div>
        <button className="sync-button" onClick={() => void sync()} disabled={status === "syncing"}>
          <span className={`pulse ${status}`} aria-hidden="true" />
          {status === "syncing" ? "Syncing" : status === "live" ? "Live" : "Reconnect"}
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
        <span>Last synced: {syncedAt} · Refreshes every 10 min</span>
      </div>
    </div>
  );
}

function Publications() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [expanded, setExpanded] = useState<number | null>(19);
  const [copied, setCopied] = useState<number | null>(null);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return publications.filter((paper) => {
      const matchesType = type === "All" || paper.type === type;
      const haystack = [paper.title, paper.venue, paper.authors, ...paper.tags].join(" ").toLowerCase();
      return matchesType && (!normalized || haystack.includes(normalized));
    });
  }, [query, type]);

  const copyCitation = async (paper: Publication) => {
    await navigator.clipboard.writeText(paper.citation);
    setCopied(paper.id);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <section id="publications" className="section publications-section">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow">PUBLICATIONS</p>
          <h2>Publications & patents</h2>
        </div>
        <p>Explore my research outputs and work in progress.</p>
      </div>
      <div className="publication-tools">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, journal, author, or keyword"
            aria-label="Search research outputs"
          />
        </label>
        <div className="filters" aria-label="Filter by publication type">
          {["All", "Journal article", "Under review", "Conference", "Patent"].map((item) => (
            <button
              key={item}
              className={type === item ? "active" : ""}
              onClick={() => setType(item)}
              aria-pressed={type === item}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="publication-list">
        {visible.map((paper) => {
          const isOpen = expanded === paper.id;
          return (
            <article className={`publication ${isOpen ? "open" : ""}`} key={paper.id}>
              <button
                className="publication-summary"
                onClick={() => setExpanded(isOpen ? null : paper.id)}
                aria-expanded={isOpen}
              >
                <span className="publication-year">{paper.year}</span>
                <div className="publication-main">
                  <div className="publication-meta">
                    <span>{paper.type}</span>
                    {paper.featured && <span className="featured">FEATURED</span>}
                  </div>
                  <h3>{paper.title}</h3>
                  <p>{paper.authors}</p>
                  <p className="venue">{paper.venue}</p>
                </div>
                <span className="expand-icon" aria-hidden="true">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <div className="publication-detail">
                  <p>{paper.abstract}</p>
                  <div className="tags">
                    {paper.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                  <div className="paper-actions">
                    <button onClick={() => void copyCitation(paper)}>
                      {copied === paper.id ? "Citation copied ✓" : "Copy citation"}
                    </button>
                    {paper.doi && (
                      <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer">DOI ↗</a>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
        {visible.length === 0 && <p className="empty-state">No matching results. Try another keyword.</p>}
      </div>
    </section>
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
          {awards.map((award) => (
            <article key={`${award.year}-${award.title}`}>
              <span>{award.year}</span>
              <p>{award.title}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const copyEmail = async () => {
    await navigator.clipboard.writeText(PROFILE.email);
    setEmailCopied(true);
    window.setTimeout(() => setEmailCopied(false), 1800);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <main>
      <header className="site-header">
        <a href="#top" className="wordmark" onClick={closeMenu} aria-label="Back to home">
          RX<span>·</span>
        </a>
        <nav className={menuOpen ? "open" : ""} aria-label="Main navigation">
          <a href="#about" onClick={closeMenu}>About</a>
          <a href="#research" onClick={closeMenu}>Research</a>
          <a href="#publications" onClick={closeMenu}>Publications</a>
          <a href="#experience" onClick={closeMenu}>Experience</a>
          <a href="#awards" onClick={closeMenu}>Honours</a>
          <a href="#contact" onClick={closeMenu}>Contact</a>
        </nav>
        <div className="header-actions">
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? "◐" : "◑"}
          </button>
          <button
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
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
            <a href="#research" className="text-link">Explore my research <span>↓</span></a>
          </div>
        </div>
        <div className="hero-footer">
          <span>{PROFILE.affiliation}</span>
          <span>{PROFILE.location}</span>
          <span>STRUCTURES · WIND · CONTROL</span>
        </div>
      </section>

      <section id="about" className="section about-section">
        <div className="about-label">
          <p className="eyebrow">ABOUT</p>
          <span className="large-index">01</span>
        </div>
        <div className="about-copy">
          <p className="lead-copy">
            My research connects <span>bridge wind engineering, nonlinear dynamics, and structural resilience</span> to keep long-span bridges safe, stable, and efficient.
          </p>
          <div className="about-columns">
            <p>I am a PhD researcher at Tongji University and a visiting PhD researcher at the University of Toronto. My work focuses on the theory, design, and experimental validation of nonlinear energy sink inerters for controlling vortex-induced vibrations, buffeting, and flutter in bridges.</p>
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
          {focusAreas.map((area) => (
            <article className="focus-card" key={area.index}>
              <div className="focus-top">
                <span>{area.index}</span>
                <span className="focus-mark" aria-hidden="true" />
              </div>
              <h3>{area.title}</h3>
              <p className="focus-text">{area.text}</p>
              <button onClick={() => document.querySelector("#publications")?.scrollIntoView({ behavior: "smooth" })}>
                View publications <span>↗</span>
              </button>
            </article>
          ))}
        </div>
        <LiveResearchFeed />
      </section>

      <Publications />
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
              <p>{update.text}</p>
              <span aria-hidden="true">↗</span>
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
      </footer>
    </main>
  );
}
