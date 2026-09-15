"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import siteContentData from "../content/site-content.json";

type Publication = {
  id: number;
  year: number;
  type: "论文" | "审稿中" | "会议" | "专利";
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
    chineseName: string;
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
  title?: { title?: { value?: string } };
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

    if (!unique.has(key)) {
      unique.set(key, {
        id: String(work["put-code"]),
        title,
        publicationDate,
        doi,
        venue: work["journal-title"]?.value || "ORCID WORKS",
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
              venue: openAlex.primary_location?.source?.display_name || work.venue,
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
        new Intl.DateTimeFormat("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    } catch {
      setWorks(fallbackLiveWorks);
      setStatus("fallback");
      setSyncedAt("已显示本地备份");
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
          <p className="eyebrow">LIVE SCHOLARLY PROFILE / 实时学术同步</p>
          <h3>最新成果与引用动态</h3>
        </div>
        <button className="sync-button" onClick={() => void sync()} disabled={status === "syncing"}>
          <span className={`pulse ${status}`} aria-hidden="true" />
          {status === "syncing" ? "同步中" : status === "live" ? "在线" : "重新连接"}
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
                {typeof work.citedBy === "number" ? ` · OPENALEX 引用 ${work.citedBy}` : ""}
              </span>
            </div>
            <span className="north-east" aria-hidden="true">↗</span>
          </article>
        ))}
      </div>
      <div className="live-foot">
        <span>数据源 ORCID + OPENALEX · GOOGLE SCHOLAR 直达</span>
        <span>上次同步 {syncedAt} · 每 10 分钟自动刷新</span>
      </div>
    </div>
  );
}

function Publications() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("全部");
  const [expanded, setExpanded] = useState<number | null>(19);
  const [copied, setCopied] = useState<number | null>(null);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return publications.filter((paper) => {
      const matchesType = type === "全部" || paper.type === type;
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
          <p className="eyebrow">PUBLICATIONS / 学术成果</p>
          <h2>论文、会议与专利</h2>
        </div>
        <p>依据最新学术履历整理，可按类型筛选、关键词检索、展开研究简介并复制引用。</p>
      </div>
      <div className="publication-tools">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、期刊、作者或关键词"
            aria-label="搜索学术成果"
          />
        </label>
        <div className="filters" aria-label="按类型筛选">
          {["全部", "论文", "审稿中", "会议", "专利"].map((item) => (
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
                      {copied === paper.id ? "引用已复制 ✓" : "复制引用"}
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
        {visible.length === 0 && <p className="empty-state">没有匹配的成果，试试其他关键词。</p>}
      </div>
    </section>
  );
}

function AcademicPath() {
  return (
    <section id="experience" className="section path-section">
      <div className="section-heading split-heading">
        <div>
          <p className="eyebrow">ACADEMIC PATH / 学术路径</p>
          <h2>从结构防护到桥梁风振</h2>
        </div>
        <p>跨越桥梁工程、冲击动力学与非线性振动控制，并在同济大学与多伦多大学开展联合研究。</p>
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
          <p className="eyebrow">FUNDED RESEARCH / 科研项目</p>
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
        <p className="eyebrow">SELECTED HONOURS / 代表荣誉</p>
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
        <a href="#top" className="wordmark" onClick={closeMenu} aria-label="回到首页">
          RX<span>·</span>
        </a>
        <nav className={menuOpen ? "open" : ""} aria-label="主导航">
          <a href="#about" onClick={closeMenu}>关于</a>
          <a href="#research" onClick={closeMenu}>研究</a>
          <a href="#publications" onClick={closeMenu}>成果</a>
          <a href="#experience" onClick={closeMenu}>经历</a>
          <a href="#awards" onClick={closeMenu}>荣誉</a>
          <a href="#contact" onClick={closeMenu}>联系</a>
        </nav>
        <div className="header-actions">
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={theme === "light" ? "切换到深色模式" : "切换到浅色模式"}
          >
            {theme === "light" ? "◐" : "◑"}
          </button>
          <button
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="打开或关闭导航"
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
            <p className="hero-prefix">{PROFILE.chineseName}</p>
            <h1><span>RUIHONG</span><span className="hero-last-name">XIE</span></h1>
          </div>
          <div className="hero-intro">
            <p className="role">{PROFILE.title}</p>
            <p className="hero-statement">{PROFILE.statement}</p>
            <a href="#research" className="text-link">进入研究现场 <span>↓</span></a>
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
          <p className="eyebrow">ABOUT / 关于</p>
          <span className="large-index">01</span>
        </div>
        <div className="about-copy">
          <p className="lead-copy">
            我的研究连接<span>桥梁风工程、非线性动力学与结构韧性</span>，让大跨桥梁在风与振动中保持安全、稳定与高效。
          </p>
          <div className="about-columns">
            <p>目前在同济大学攻读博士学位，并于多伦多大学开展联合培养研究。工作聚焦非线性能量阱惯容器在桥梁涡激振动、抖振与颤振控制中的理论、设计与试验验证。</p>
            <p>此前在湖南大学研究桥梁冲击动力与复合防护结构。现在进一步探索减振与振动能量收集的协同机制，把结构安全、装置效率和工程可实施性放进同一套设计框架。</p>
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
            <p className="eyebrow">RESEARCH AGENDA / 研究方向</p>
            <h2>四条互相连接的研究主线</h2>
          </div>
          <p>从风致响应机理到控制装置，从实时混合试验到工程防护，围绕“更安全、更轻量、更可持续”的结构控制持续推进。</p>
        </div>
        <div className="focus-grid">
          {focusAreas.map((area) => (
            <article className="focus-card" key={area.index}>
              <div className="focus-top">
                <span>{area.index}</span>
                <span className="focus-mark" aria-hidden="true" />
              </div>
              <h3>{area.title}</h3>
              <p className="focus-en">{area.en}</p>
              <p className="focus-text">{area.text}</p>
              <button onClick={() => document.querySelector("#publications")?.scrollIntoView({ behavior: "smooth" })}>
                查看相关成果 <span>↗</span>
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
            <p className="eyebrow">NEWS & MILESTONES / 近期动态</p>
            <h2>研究进展</h2>
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
          <p className="eyebrow">RESEARCH COLLABORATION / 学术合作</p>
          <h2>一起解决桥梁在风与振动中的<em>关键问题。</em></h2>
          <button className="email-button" onClick={() => void copyEmail()}>
            {emailCopied ? "邮箱已复制 ✓" : "复制邮箱"}<span>↗</span>
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
