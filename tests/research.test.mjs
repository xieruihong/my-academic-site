import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFilters, filterPublications, toBibTeX, topics } from "../src/research.ts";

const papers = JSON.parse(readFileSync(new URL("../content/site-content.json", import.meta.url))).publications;

test("default library retains every output and puts published journal articles first", () => {
  const ordered = filterPublications(papers, emptyFilters);
  assert.equal(ordered.length, papers.length);
  assert.equal(ordered[0].id, 1);
  const firstReview = ordered.findIndex(paper => paper.type === "Under review");
  assert.ok(ordered.slice(0, firstReview).every(paper => paper.type === "Journal article"));
  assert.equal(papers[0].id, 19, "source ordering is not mutated");
});

test("topic cards resolve to distinct relevant research sets", () => {
  const results = Object.fromEntries(topics.map(topic => [topic.id, filterPublications(papers, { ...emptyFilters, topic: topic.id }).map(paper => paper.id)]));
  assert.ok(results.energy.includes(20) && results.energy.includes(16));
  assert.ok(!results.energy.includes(10), "energy absorption is not energy harvesting");
  assert.ok(results.impact.includes(10) && results.impact.includes(31));
  assert.ok(!results.impact.includes(1));
  assert.ok(results.wind.includes(1) && results.nonlinear.includes(2));
});

test("search, year, type and topic filters compose and handle empty results", () => {
  assert.deepEqual(filterPublications(papers, { query: "Mercan 106455", year: "2026", type: "Journal article", topic: "wind" }).map(paper => paper.id), [1]);
  assert.equal(filterPublications(papers, { ...emptyFilters, query: "not-a-real-output" }).length, 0);
  assert.ok(filterPublications(papers, { ...emptyFilters, type: "Under review" }).every(paper => paper.type === "Under review"));
});

test("BibTeX preserves authors, DOI and review status without invented publication fields", () => {
  const article = toBibTeX(papers.find(paper => paper.id === 1));
  assert.ok(article.startsWith("@article{Xie2026_1,"));
  assert.ok(article.includes("Ruihong Xie and Oya Mercan"));
  assert.ok(article.includes("doi = {10.1016/j.jweia.2026.106455}"));
  assert.ok(!article.includes("Lin Zhao*"));
  assert.ok(toBibTeX(papers.find(paper => paper.id === 19)).startsWith("@unpublished"));
  assert.ok(toBibTeX(papers.find(paper => paper.id === 19)).includes("Under review"));
  assert.ok(toBibTeX(papers.find(paper => paper.id === 23)).startsWith("@misc"));
  assert.ok(!article.includes("pages ="));
});
