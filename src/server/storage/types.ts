import {
  BootstrapReview,
  BootstrapReviewCard,
  EventRecord,
  FocusState,
  InteractionSignal,
  MemoryCandidate,
  MemoryItem
} from "../../shared/types.js";

export interface Repository<T> {
  get(id: string): T | undefined;
  set(id: string, value: T): void;
  values(): T[];
  clear(): void;
  readonly size: number;
}

export type EventRepository = Repository<EventRecord>;
export type BootstrapReviewRepository = Repository<BootstrapReview>;
export type BootstrapReviewCardRepository = Repository<BootstrapReviewCard>;
export type MemoryCandidateRepository = Repository<MemoryCandidate>;
export type MemoryItemRepository = Repository<MemoryItem>;
export type InteractionSignalRepository = Repository<InteractionSignal>;
export type FocusStateRepository = Repository<FocusState>;

export interface LifeOSStorage {
  readonly driver: "memory" | "sqlite";
  events: EventRepository;
  bootstrapReviews: BootstrapReviewRepository;
  bootstrapCards: BootstrapReviewCardRepository;
  candidates: MemoryCandidateRepository;
  memoryItems: MemoryItemRepository;
  interactionSignals: InteractionSignalRepository;
  focusStates: FocusStateRepository;
  reset(): void;
  close?(): void;
}

