export type Publication = {
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

export const topics = [
  { id: "wind", label: "Wind engineering", matches: /wind|vortex|buffeting|flutter|aerodynamic|shear flow|\bVIV\b/i },
  { id: "nonlinear", label: "Nonlinear control", matches: /nonlinear|\bNESI\b/i },
  { id: "energy", label: "Energy harvesting", matches: /energy harvesting/i },
  { id: "impact", label: "Impact & protection", matches: /impact|rockfall|collision|crushing|protection|protective|interception|crashworthiness/i },
] as const;

export type Filters = { query: string; type: string; year: string; topic: string };
export const emptyFilters: Filters = { query: "", type: "All", year: "All", topic: "All" };
const typeOrder: Record<Publication["type"], number> = { "Journal article": 0, "Under review": 1, Conference: 2, Patent: 3 };

export function filterPublications(papers: Publication[], filters: Filters): Publication[] {
  const words = filters.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const topic = topics.find(item => item.id === filters.topic);
  return papers.filter(paper => {
    const haystack = [paper.title, paper.venue, paper.authors, paper.year, paper.doi, ...paper.tags].join(" ").toLowerCase();
    return (filters.type === "All" || paper.type === filters.type)
      && (filters.year === "All" || String(paper.year) === filters.year)
      && (!topic || topic.matches.test([paper.title, ...paper.tags].join(" ")))
      && words.every(word => haystack.includes(word));
  }).sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || b.year - a.year || a.id - b.id);
}

function tex(value: string): string {
  return value.replace(/[\\{}&%$#_^~]/g, character => ({
    "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "&": "\\&", "%": "\\%", "$": "\\$", "#": "\\#", "_": "\\_", "^": "\\textasciicircum{}", "~": "\\textasciitilde{}",
  })[character]!);
}

export function toBibTeX(paper: Publication): string {
  const kind = paper.type === "Journal article" ? "article" : paper.type === "Under review" ? "unpublished" : "misc";
  const fields: Record<string, string> = {
    title: `{${tex(paper.title)}}`,
    author: paper.authors.split(/,\s*/).map(author => tex(author.replace(/\*/g, "").trim())).join(" and "),
    year: String(paper.year),
  };
  // Preserve the supplied venue verbatim; do not invent volumes, pages, or proceedings.
  if (kind === "article") fields.journal = tex(paper.venue.split(",")[0]);
  fields.note = tex(paper.venue);
  if (paper.doi) {
    fields.doi = tex(paper.doi);
    fields.url = tex(`https://doi.org/${paper.doi}`);
  }
  return `@${kind}{Xie${paper.year}_${paper.id},\n${Object.entries(fields).map(([key, value]) => `  ${key} = {${value}}`).join(",\n")}\n}`;
}

export function downloadText(text: string, filename: string, mime = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function scrollToId(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
}
