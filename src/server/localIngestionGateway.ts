import { createHash } from "node:crypto";
import { AppError } from "./errors.js";

export type ApprovedTextSource = {
  source_type?: string;
  display_name?: string;
  source_ref?: string;
  raw_text?: string;
  text?: string;
  approved_by_user?: boolean;
};

export type NormalizedIngestionSource = {
  source_type: string;
  display_name: string;
  source_ref: string;
  raw_text: string;
  checksum: string;
  preview: {
    character_count: number;
    line_count: number;
    excerpt: string;
  };
  audit: {
    approved_by_user: true;
    user_initiated: true;
    normalized_at: string;
  };
};

export function normalizeApprovedTextSources(input: unknown): NormalizedIngestionSource[] {
  const body = (input ?? {}) as Record<string, any>;
  const approvedSources = Array.isArray(body.sources) ? body.sources.filter((source: ApprovedTextSource) => source.approved_by_user) : [];
  const normalized: NormalizedIngestionSource[] = [];

  if (typeof body.raw_text === "string" && body.raw_text.trim()) {
    normalized.push(normalizeSourceText(body.raw_text, approvedSources[0], 0));
  }

  if (typeof body.text === "string" && body.text.trim() && body.text !== body.raw_text) {
    normalized.push(normalizeSourceText(body.text, approvedSources[0], normalized.length));
  }

  approvedSources.forEach((source: ApprovedTextSource) => {
    const sourceText = typeof source.raw_text === "string" ? source.raw_text : typeof source.text === "string" ? source.text : "";
    if (sourceText.trim()) {
      normalized.push(normalizeSourceText(sourceText, source, normalized.length));
    }
  });

  const deduped = dedupeSources(normalized);
  if (deduped.length === 0) {
    throw new AppError("CONSENT_REQUIRED", "Bootstrap requires at least one user-approved source", 400);
  }

  return deduped;
}

export function buildIngestionPreview(input: unknown) {
  const sources = normalizeApprovedTextSources(input);
  return {
    status: "ready",
    sources_total: sources.length,
    total_characters: sources.reduce((sum, source) => sum + source.preview.character_count, 0),
    sources: sources.map((source) => ({
      source_type: source.source_type,
      display_name: source.display_name,
      source_ref: source.source_ref,
      checksum: source.checksum,
      preview: source.preview,
      approved_by_user: true
    }))
  };
}

function normalizeSourceText(rawText: string, source: ApprovedTextSource | undefined, index: number): NormalizedIngestionSource {
  const normalizedText = rawText.replace(/\r\n/g, "\n").trim();
  const checksum = createHash("sha256").update(normalizedText).digest("hex");
  return {
    source_type: source?.source_type ?? "pasted_text",
    display_name: source?.display_name ?? "Approved text",
    source_ref: source?.source_ref ?? `approved_text_${index + 1}`,
    raw_text: normalizedText,
    checksum,
    preview: {
      character_count: normalizedText.length,
      line_count: normalizedText ? normalizedText.split("\n").length : 0,
      excerpt: normalizedText.slice(0, 180)
    },
    audit: {
      approved_by_user: true,
      user_initiated: true,
      normalized_at: new Date().toISOString()
    }
  };
}

function dedupeSources(sources: NormalizedIngestionSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.checksum)) {
      return false;
    }
    seen.add(source.checksum);
    return true;
  });
}

