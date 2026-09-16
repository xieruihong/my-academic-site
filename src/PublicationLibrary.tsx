import { useEffect, useMemo, useRef, useState } from "react";
import content from "../content/site-content.json";
import { downloadText, emptyFilters, filterPublications, scrollToId, toBibTeX, topics, type Filters, type Publication } from "./research";

const papers = content.publications as Publication[];
const years = [...new Set(papers.map(paper => paper.year))].sort((a, b) => b - a);
const types = ["All", "Journal article", "Under review", "Conference", "Patent"];
const labels: Record<string, string> = { All: "All outputs", "Journal article": "Journal articles", "Under review": "Under review", Conference: "Conferences", Patent: "Patents" };

export function AuthorNames({ authors }: { authors: string }) {
  return <>{authors.split(/(Ruihong Xie\*?)/g).map((part, index) => part.startsWith("Ruihong Xie") ? <strong className="author-self" key={index}>{part}</strong> : part)}</>;
}

export function SelectedPublications() {
  return (
    <section id="selected" className="section selected-section">
      <div className="section-heading split-heading">
        <div><p className="eyebrow">SELECTED PUBLICATIONS</p><h2>Research in focus.</h2></div>
        <a className="text-link" href="#publications">Browse all research outputs <span aria-hidden="true">↓</span></a>
      </div>
      <div className="selected-grid">
        {papers.filter(paper => paper.featured && paper.type === "Journal article").slice(0, 3).map(paper => (
          <article className="selected-paper" key={paper.id}>
            <div className="selected-meta"><span>{paper.year} · JOURNAL ARTICLE</span><span aria-hidden="true">↗</span></div>
            <p className="selected-venue">{paper.venue.split(",")[0]}</p>
            <h3><a href={`#paper-${paper.id}`}>{paper.title}</a></h3>
            <p className="selected-contribution">{paper.abstract}</p>
            <div className="selected-bottom"><a href={`#paper-${paper.id}`}>Details & citation <span aria-hidden="true">→</span></a><a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer" aria-label={`Open DOI for ${paper.title}`}>DOI ↗</a></div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function PublicationLibrary({ request }: { request: { topic: string; key: number } }) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [manual, setManual] = useState<{ label: string; value: string } | null>(null);
  const [limit, setLimit] = useState(8);
  const feedbackTimer = useRef<number | undefined>(undefined);
  const copyTrigger = useRef<HTMLElement | null>(null);
  const visible = useMemo(() => filterPublications(papers, filters), [filters]);
  const active = Object.keys(emptyFilters).some(key => filters[key as keyof Filters] !== emptyFilters[key as keyof Filters]);

  useEffect(() => {
    if (!request.key) return;
    setFilters({ ...emptyFilters, topic: request.topic });
    setExpanded(null);
    setLimit(8);
  }, [request]);

  useEffect(() => {
    if (!manual) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setManual(null); setFeedback(""); copyTrigger.current?.focus(); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [manual]);

  useEffect(() => {
    let frame = 0;
    const openSharedPaper = () => {
      const match = window.location.hash.match(/^#paper-(\d+)$/);
      if (!match || !papers.some(paper => paper.id === Number(match[1]))) return;
      const id = Number(match[1]);
      setFilters(emptyFilters);
      setExpanded(id);
      setLimit(papers.length);
      frame = window.requestAnimationFrame(() => scrollToId(`paper-${id}`));
    };
    openSharedPaper();
    window.addEventListener("hashchange", openSharedPaper);
    // Clicking the same deep link should reopen a paper after filters change.
    const sameLink = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.('a[href^="#paper-"]');
      if (link?.getAttribute("href") === window.location.hash) openSharedPaper();
    };
    document.addEventListener("click", sameLink);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("hashchange", openSharedPaper); document.removeEventListener("click", sameLink); window.clearTimeout(feedbackTimer.current); };
  }, []);

  const change = (key: keyof Filters, value: string) => { setFilters(current => ({ ...current, [key]: value })); setManual(null); setLimit(8); };
  const copy = async (value: string, label: string) => {
    copyTrigger.current = document.activeElement as HTMLElement | null;
    window.clearTimeout(feedbackTimer.current);
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setManual(null);
      setFeedback(`${label} copied.`);
      feedbackTimer.current = window.setTimeout(() => setFeedback(""), 3500);
    } catch {
      setFeedback("Clipboard unavailable. Select and copy the text below.");
      setManual({ label, value });
    }
  };

  return (
    <section id="publications" className="section publications-section">
      <div className="section-heading split-heading">
        <div><p className="eyebrow">RESEARCH LIBRARY</p><h2>Publications & patents</h2></div>
        <p>Published work, conference contributions, patents, and manuscripts under review.</p>
      </div>
      <div className="library-controls">
        <div className="filters" role="group" aria-label="Filter by publication type">
          {types.map(type => <button key={type} className={filters.type === type ? "active" : ""} onClick={() => change("type", type)} aria-pressed={filters.type === type}>{labels[type]}</button>)}
        </div>
        <div className="library-search-row">
          <label className="search-box"><span aria-hidden="true">⌕</span><input value={filters.query} onChange={event => change("query", event.target.value)} placeholder="Search title, author, keyword, or DOI" aria-label="Search research outputs" type="search" /></label>
          <label className="select-field"><span>Research topic</span><select value={filters.topic} onChange={event => change("topic", event.target.value)}><option value="All">All topics</option>{topics.map(topic => <option value={topic.id} key={topic.id}>{topic.label}</option>)}</select></label>
          <label className="select-field year-field"><span>Year</span><select value={filters.year} onChange={event => change("year", event.target.value)}><option value="All">All years</option>{years.map(year => <option key={year}>{year}</option>)}</select></label>
        </div>
        <div className="library-results"><p role="status">{visible.length} {visible.length === 1 ? "result" : "results"}{filters.type === "All" && !active ? " · Journal articles first" : ""}</p><button className="clear-filters" disabled={!active} onClick={() => { setFilters(emptyFilters); setManual(null); }}>Clear filters</button></div>
      </div>
      <p className={`copy-feedback ${feedback ? "visible" : ""}`} role="status">{feedback}</p>
      {manual && <aside className="manual-copy" aria-label="Manual copy"><label htmlFor="manual-citation">{manual.label} · Select and copy below</label><textarea id="manual-citation" autoFocus readOnly value={manual.value} onFocus={event => event.target.select()} /><button onClick={() => { setManual(null); setFeedback(""); copyTrigger.current?.focus(); }}>Close</button></aside>}
      <div className="publication-list">
        {visible.map((paper, index) => {
          const open = expanded === paper.id;
          return <article id={`paper-${paper.id}`} className={`publication ${open ? "open" : ""}`} key={paper.id} hidden={index >= limit}>
            <h3 className="publication-heading"><button className="publication-summary" onClick={() => setExpanded(open ? null : paper.id)} aria-expanded={open} aria-controls={`paper-detail-${paper.id}`}>
              <span className="publication-year">{paper.year}</span>
              <span className="publication-main"><span className="publication-meta"><span className={paper.type === "Under review" ? "review-badge" : ""}>{paper.type}</span>{paper.featured && <span className="featured">SELECTED</span>}</span><span className="publication-title">{paper.title}</span><span className="publication-authors"><AuthorNames authors={paper.authors} /></span><span className="venue">{paper.venue}</span></span>
              <span className="expand-icon" aria-hidden="true">{open ? "−" : "+"}</span>
            </button></h3>
            <div id={`paper-detail-${paper.id}`} className="publication-detail" hidden={!open}>
              <p className="detail-label">RESEARCH SUMMARY</p><p>{paper.abstract}</p>
              <div className="tags">{paper.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
              <div className="paper-actions">
                {paper.doi && <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer">View publication ↗</a>}
                <button onClick={() => void copy(paper.citation, "Citation")}>Copy citation</button>
                <button onClick={() => downloadText(toBibTeX(paper), `Xie-${paper.year}-${paper.id}.bib`, "application/x-bibtex;charset=utf-8")}>Download BibTeX ↓</button>
                <button onClick={() => { const url = new URL(window.location.href); url.search = ""; url.hash = `paper-${paper.id}`; void copy(url.href, "Paper link"); }}>Copy link</button>
              </div>
            </div>
          </article>;
        })}
        {visible.length === 0 && <div className="empty-state"><h3>No matching research outputs.</h3><p>Try a broader keyword or clear the topic, year, and publication-type filters.</p><button onClick={() => setFilters(emptyFilters)}>Clear all filters</button></div>}
      </div>
      {visible.length > 8 && <div className="library-pagination"><span>Showing {Math.min(limit, visible.length)} of {visible.length} results</span>{limit < visible.length ? <button onClick={() => setLimit(visible.length)}>Show all results <span aria-hidden="true">↓</span></button> : <button onClick={() => { setLimit(8); scrollToId("publications"); }}>Show fewer <span aria-hidden="true">↑</span></button>}</div>}
    </section>
  );
}
