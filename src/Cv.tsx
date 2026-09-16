import content from "../content/site-content.json";
import { AuthorNames } from "./PublicationLibrary";
import { emptyFilters, filterPublications, type Publication } from "./research";

export default function Cv() {
  const papers = filterPublications(content.publications as Publication[], emptyFilters);
  return <main className="cv-page">
    <div className="cv-toolbar"><a href="./">← Academic homepage</a><button onClick={() => window.print()}>Print / Save as PDF</button></div>
    <header className="cv-header"><p className="eyebrow">CURRICULUM VITAE</p><h1>{content.profile.name}</h1><p>{content.profile.title}</p><div className="cv-contact"><a href={`mailto:${content.profile.email}`}>{content.profile.email}</a><a href={content.links.scholar}>Google Scholar</a><a href={content.links.orcid}>ORCID</a></div><p className="cv-note">Public academic profile · Updated September 2026</p></header>
    <section><h2>Research interests</h2><p>{content.profile.statement}</p><ul>{content.focusAreas.map(area => <li key={area.index}>{area.title}</li>)}</ul></section>
    <section><h2>Education & research experience</h2>{content.education.map(item => <article className="cv-entry" key={`${item.period}-${item.institution}`}><p className="cv-date">{item.period}</p><h3>{item.institution}</h3><p>{item.degree}</p><p className="cv-detail">{item.detail}</p></article>)}</section>
    <section><h2>Funded research</h2>{content.projects.map(project => <article className="cv-entry" key={project.title}><p className="cv-date">{project.period}</p><h3>{project.title}</h3><p className="cv-detail">{project.meta}</p></article>)}</section>
    {(["Journal article", "Under review", "Conference", "Patent"] as const).map(type => <section key={type}><h2>{{ "Journal article": "Journal articles", "Under review": "Manuscripts under review", Conference: "Conference papers & presentations", Patent: "Patents" }[type]}</h2><ol className="cv-publications">{papers.filter(paper => paper.type === type).map(paper => <li key={paper.id}><p><AuthorNames authors={paper.authors} /> ({paper.year}).</p><h3>{paper.title}</h3><p><em>{paper.venue}</em></p>{paper.doi && <a href={`https://doi.org/${paper.doi}`}>https://doi.org/{paper.doi}</a>}</li>)}</ol></section>)}
    <section><h2>Honours & awards</h2><ul className="cv-awards">{content.awards.map(award => <li key={`${award.year}-${award.title}`}><span>{award.year}</span> {award.title}</li>)}</ul></section>
    <footer className="cv-footer"><a href="https://xieruihong.github.io/my-academic-site/">xieruihong.github.io/my-academic-site</a></footer>
  </main>;
}
