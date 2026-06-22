import { Ajv2020 } from "ajv/dist/2020.js";
import addFormatsPlugin from "ajv-formats";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppError } from "./errors.js";

const schemaFiles = {
  event: "event.v1.schema.json",
  memoryItem: "memory_item.v1.schema.json",
  focusState: "focus_state.v1.schema.json",
  bootstrapReview: "bootstrap_review.v1.schema.json",
  bootstrapReviewCard: "bootstrap_review_card.v1.schema.json",
  actionProposal: "action_proposal.v1.schema.json",
  interactionSignal: "interaction_signal.v1.schema.json"
} as const;

export const ajv = new Ajv2020({ allErrors: true, strict: false });
(addFormatsPlugin as unknown as (instance: Ajv2020) => void)(ajv);

const loadSchema = (filename: string) => {
  const fullPath = resolve(process.cwd(), "schemas", filename);
  return JSON.parse(readFileSync(fullPath, "utf8"));
};

export const validators = Object.fromEntries(
  Object.entries(schemaFiles).map(([key, filename]) => [key, ajv.compile(loadSchema(filename))])
) as Record<keyof typeof schemaFiles, ReturnType<typeof ajv.compile>>;

export function assertValid(schemaName: keyof typeof schemaFiles, value: unknown, message: string) {
  const validate = validators[schemaName];
  if (!validate(value)) {
    throw new AppError("VALIDATION_ERROR", message, 400, validate.errors ?? []);
  }
}
