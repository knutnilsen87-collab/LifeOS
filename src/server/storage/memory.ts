import { LifeOSStorage, Repository } from "./types.js";

export class MemoryRepository<T> implements Repository<T> {
  private readonly items = new Map<string, T>();

  get(id: string) {
    return this.items.get(id);
  }

  set(id: string, value: T) {
    this.items.set(id, value);
  }

  values() {
    return [...this.items.values()];
  }

  clear() {
    this.items.clear();
  }

  get size() {
    return this.items.size;
  }
}

export class MemoryLifeOSStore implements LifeOSStorage {
  readonly driver = "memory";
  events = new MemoryRepository<import("../../shared/types.js").EventRecord>();
  bootstrapReviews = new MemoryRepository<import("../../shared/types.js").BootstrapReview>();
  bootstrapCards = new MemoryRepository<import("../../shared/types.js").BootstrapReviewCard>();
  candidates = new MemoryRepository<import("../../shared/types.js").MemoryCandidate>();
  memoryItems = new MemoryRepository<import("../../shared/types.js").MemoryItem>();
  interactionSignals = new MemoryRepository<import("../../shared/types.js").InteractionSignal>();
  focusStates = new MemoryRepository<import("../../shared/types.js").FocusState>();

  reset() {
    this.events.clear();
    this.bootstrapReviews.clear();
    this.bootstrapCards.clear();
    this.candidates.clear();
    this.memoryItems.clear();
    this.interactionSignals.clear();
    this.focusStates.clear();
  }
}

