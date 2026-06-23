import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { AppError } from "./errors.js";
import { createEvent, recordInteractionSignal } from "./domain.js";
import { LifeOSStorage } from "./store.js";

const maxImportBytes = 200_000;

export function importReadOnlySource(db: LifeOSStorage, input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  if (body.approved_by_user !== true) {
    throw new AppError("CONSENT_REQUIRED", "Read-only integration import requires explicit user approval", 400);
  }
  const sourceType = String(body.source_type ?? "");
  const normalized =
    sourceType === "local_file"
      ? localFileSource(body)
      : sourceType === "calendar"
        ? calendarSource(body)
        : sourceType === "github"
          ? githubSource(body)
          : sourceType === "docs"
            ? docsSource(body)
            : null;

  if (!normalized) {
    throw new AppError("VALIDATION_ERROR", "Unsupported read-only integration source", 400);
  }

  const event = createEvent(
    {
      event_type: "integration_import",
      source: {
        source_type: normalized.source_type,
        source_name: normalized.display_name,
        source_ref: normalized.source_ref,
        origin: normalized.source_type === "local_file" ? "local_device" : "cloud_integration"
      },
      capture: {
        capture_method: "integration_read_only",
        user_initiated: true
      },
      content: {
        content_type: "text/plain",
        raw_text: normalized.raw_text,
        checksum: checksum(normalized.raw_text),
        language: normalized.language
      },
      privacy: {
        privacy_level: normalized.privacy_level
      },
      classification: {
        integration_adapter: sourceType,
        read_only: true
      }
    },
    db
  );

  recordInteractionSignal(
    {
      user_id: event.user_id,
      workspace_id: event.workspace_id,
      source_surface: "integration_import",
      target: { event_id: event.event_id },
      signal_type: `integration_import_${sourceType}`,
      feedback: { interaction: "approved_read_only_import" }
    },
    db
  );

  return {
    status: "imported",
    mode: "read_only",
    event_id: event.event_id,
    checksum: event.content.checksum,
    preview: preview(normalized.raw_text),
    source: normalized
  };
}

function localFileSource(body: Record<string, unknown>) {
  const path = String(body.path ?? "");
  if (!path) {
    throw new AppError("VALIDATION_ERROR", "path is required for local_file import", 400);
  }
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    throw new AppError("VALIDATION_ERROR", "Local file does not exist", 400);
  }
  const stat = statSync(resolved);
  if (!stat.isFile()) {
    throw new AppError("VALIDATION_ERROR", "Local file import requires a file path", 400);
  }
  if (stat.size > maxImportBytes) {
    throw new AppError("VALIDATION_ERROR", "Local file import exceeds the safe preview size limit", 400);
  }
  const rawText = readFileSync(resolved, "utf8");
  return {
    source_type: "local_file",
    display_name: String(body.display_name ?? basename(resolved)),
    source_ref: resolved,
    raw_text: rawText,
    language: String(body.language ?? "nb"),
    privacy_level: String(body.privacy_level ?? "private_user")
  };
}

function calendarSource(body: Record<string, unknown>) {
  const rawText = String(body.raw_text ?? "").trim();
  if (!rawText) {
    throw new AppError("VALIDATION_ERROR", "raw_text is required for calendar import", 400);
  }
  return {
    source_type: "calendar",
    display_name: String(body.display_name ?? "Calendar import"),
    source_ref: String(body.source_ref ?? "calendar_manual"),
    raw_text: summarizeCalendar(rawText),
    language: String(body.language ?? "nb"),
    privacy_level: String(body.privacy_level ?? "private_user")
  };
}

function githubSource(body: Record<string, unknown>) {
  const repo = String(body.repo ?? body.repo_url ?? "").trim();
  if (!repo) {
    throw new AppError("VALIDATION_ERROR", "repo or repo_url is required for GitHub import", 400);
  }
  const notes = String(body.raw_text ?? body.notes ?? "Read-only GitHub repository context approved by user.");
  return {
    source_type: "github",
    display_name: String(body.display_name ?? `GitHub ${repo}`),
    source_ref: repo,
    raw_text: `GitHub repository: ${repo}\n${notes}`,
    language: "en",
    privacy_level: String(body.privacy_level ?? "private_user")
  };
}

function docsSource(body: Record<string, unknown>) {
  const rawText = String(body.raw_text ?? "").trim();
  if (!rawText) {
    throw new AppError("VALIDATION_ERROR", "raw_text is required for docs import", 400);
  }
  return {
    source_type: "docs",
    display_name: String(body.display_name ?? "Approved document"),
    source_ref: String(body.source_ref ?? "manual_doc"),
    raw_text: rawText,
    language: String(body.language ?? "nb"),
    privacy_level: String(body.privacy_level ?? "private_user")
  };
}

function summarizeCalendar(rawText: string) {
  return rawText
    .split(/\r?\n/)
    .filter((line) => /SUMMARY|DTSTART|DTEND|DESCRIPTION/i.test(line))
    .join("\n")
    .trim();
}

function checksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function preview(value: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  return {
    character_count: value.length,
    excerpt: compact.length > 220 ? `${compact.slice(0, 217).trim()}...` : compact
  };
}
