import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validators } from "../src/server/schemas.js";

const fixture = (name: string) => JSON.parse(readFileSync(resolve(process.cwd(), "examples", name), "utf8"));

describe("schema fixtures", () => {
  it("validates the sample quick capture event", () => {
    const value = fixture("sample_event_quick_capture.json");
    expect(validators.event(value)).toBe(true);
  });

  it("validates the sample bootstrap review card", () => {
    const value = fixture("sample_bootstrap_card_task.json");
    expect(validators.bootstrapReviewCard(value)).toBe(true);
  });

  it("validates the sample focus state", () => {
    const value = fixture("sample_focus_state_focus.json");
    expect(validators.focusState(value)).toBe(true);
  });
});

