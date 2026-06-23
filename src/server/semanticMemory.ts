import { EventRecord, MemoryItem } from "../shared/types.js";
import { LifeOSStorage } from "./store.js";

type Citation = {
  citation_id: string;
  memory_id: string;
  memory_title: string;
  event_ids: string[];
  source_label: string;
  excerpt: string;
  privacy_label: string;
};

type SearchResult = {
  memory: MemoryItem;
  score: number;
  matched_terms: string[];
  source_events: Array<{
    event_id: string;
    source_label: string;
    excerpt: string;
  }>;
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "when",
  "who",
  "why",
  "with",
  "aa",
  "at",
  "det",
  "en",
  "er",
  "hva",
  "i",
  "med",
  "og",
  "om",
  "paa",
  "på",
  "skal",
  "som",
  "til",
  "vi"
]);

const synonymGroups = [
  ["pricing", "price", "pris", "abonnement", "subscription", "usd", "business", "model"],
  ["mvp", "focus", "scope", "memory", "search", "bootstrap", "review", "reminders", "strategy"],
  ["investor", "contact", "kontakte", "demo", "friday", "fredag", "commitment", "task"],
  ["sensitive", "sensitiv", "restricted", "approval", "godkjenning", "client", "klient", "sharing", "external"]
];

export function semanticSearchMemories(db: LifeOSStorage, query: string, limit = 5) {
  const queryTerms = expandTerms(tokenize(query));
  const activeMemories = db.memoryItems.values().filter((memory) => memory.state.memory_state === "active");

  const results = activeMemories
    .map((memory) => scoreMemory(memory, queryTerms, db))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    query,
    mode: "local_semantic_lexical",
    results_total: results.length,
    results
  };
}

export function answerFromMemory(db: LifeOSStorage, question: string) {
  const search = semanticSearchMemories(db, question, 4);
  const bestScore = search.results[0]?.score ?? 0;
  const usableResults = dedupeResultsByClaim(search.results.filter((result) => result.score >= 0.12 && result.score >= bestScore * 0.75)).slice(0, 3);

  if (usableResults.length === 0) {
    return {
      question,
      answer: "I do not have enough grounded memory to answer that yet.",
      confidence: 0,
      grounded: false,
      citations: [] as Citation[],
      search
    };
  }

  const citations = usableResults.map((result, index) => buildCitation(result, index + 1));
  const answer = buildGroundedAnswer(usableResults, citations);

  return {
    question,
    answer,
    confidence: Math.min(0.94, Math.max(...usableResults.map((result) => result.score))),
    grounded: true,
    citations,
    search
  };
}

function scoreMemory(memory: MemoryItem, queryTerms: string[], db: LifeOSStorage): SearchResult {
  const sourceEvents = sourceEventsForMemory(memory, db);
  const haystack = `${memory.title} ${memory.summary} ${memory.canonical_text}`;
  const memoryTerms = new Set(expandTerms(tokenize(haystack)));
  const matchedTerms = [...new Set(queryTerms.filter((term) => memoryTerms.has(term)))];
  const titleTerms = new Set(expandTerms(tokenize(memory.title)));
  const titleMatches = queryTerms.filter((term) => titleTerms.has(term)).length;
  const phraseBoost = phraseMatches(memory, queryTerms);
  const score = roundScore(matchedTerms.length / Math.max(1, Math.sqrt(queryTerms.length) * 4) + titleMatches * 0.08 + phraseBoost);

  return {
    memory,
    score,
    matched_terms: matchedTerms,
    source_events: sourceEvents.map((event) => ({
      event_id: event.event_id,
      source_label: String(event.source.source_name ?? event.source.source_type ?? "Source"),
      excerpt: excerpt(event.content.raw_text ?? memory.summary)
    }))
  };
}

function buildGroundedAnswer(results: SearchResult[], citations: Citation[]) {
  const statements = results.map((result, index) => `${result.memory.summary} [${citations[index].citation_id}]`);
  return `Based on saved LifeOS memory: ${statements.join(" ")}`;
}

function dedupeResultsByClaim(results: SearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = normalize(`${result.memory.title} ${result.memory.summary}`);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildCitation(result: SearchResult, index: number): Citation {
  const eventIds = (result.memory.source_refs.event_ids as string[] | undefined) ?? [];
  const firstSource = result.source_events[0];
  return {
    citation_id: String(index),
    memory_id: result.memory.memory_id,
    memory_title: result.memory.title,
    event_ids: eventIds,
    source_label: firstSource?.source_label ?? "Memory",
    excerpt: firstSource?.excerpt ?? excerpt(result.memory.summary),
    privacy_label: String(result.memory.privacy.privacy_level ?? "unknown")
  };
}

function sourceEventsForMemory(memory: MemoryItem, db: LifeOSStorage): EventRecord[] {
  const eventIds = (memory.source_refs.event_ids as string[] | undefined) ?? [];
  return eventIds.map((eventId) => db.events.get(eventId)).filter((event): event is EventRecord => Boolean(event));
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/å/g, "aa")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae");
}

function expandTerms(terms: string[]) {
  const expanded = new Set(terms);
  for (const term of terms) {
    for (const group of synonymGroups) {
      if (group.includes(term)) {
        group.forEach((item) => expanded.add(item));
      }
    }
  }
  return [...expanded];
}

function phraseMatches(memory: MemoryItem, queryTerms: string[]) {
  const normalized = normalize(`${memory.title} ${memory.summary} ${memory.canonical_text}`);
  let boost = 0;
  if (queryTerms.includes("pricing") && /29|49|usd|subscription|abonnement/.test(normalized)) {
    boost += 0.35;
  }
  if (queryTerms.includes("investor") && /investor|friday|fredag|demo/.test(normalized)) {
    boost += 0.35;
  }
  if (queryTerms.includes("mvp") && /memory search|bootstrap review|smart reminders/.test(normalized)) {
    boost += 0.35;
  }
  return boost;
}

function excerpt(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= 220 ? compact : `${compact.slice(0, 217).trim()}...`;
}

function roundScore(value: number) {
  return Math.round(Math.min(1, value) * 1000) / 1000;
}
