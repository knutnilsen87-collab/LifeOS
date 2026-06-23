import { EntityGraph, LifeEntity, LifeObject, MemoryItem, PrivacyLevel } from "../shared/types.js";
import { buildLifeObjects } from "./ecosystem.js";
import { notFound } from "./errors.js";
import { LifeOSStorage } from "./store.js";

export function buildEntityGraph(db: LifeOSStorage): EntityGraph {
  const snapshot = buildLifeObjects(db);
  const memories = db.memoryItems.values();
  const nodes = [
    ...snapshot.entities.map((entity) => entityNode(entity)),
    ...snapshot.objects.map((object) => ({
      id: object.object_id,
      type: "object" as const,
      label: object.title,
      privacy_level: object.privacy.privacy_level
    })),
    ...memories.map((memory) => memoryNode(memory))
  ];
  const edges = [
    ...snapshot.objects.flatMap((object) =>
      object.related_entity_ids.map((entityId) => ({ from: object.object_id, to: entityId, relationship: "relates_to" as const }))
    ),
    ...snapshot.objects.flatMap((object) =>
      object.source_memory_ids.map((memoryId) => ({ from: memoryId, to: object.object_id, relationship: "source_of" as const }))
    ),
    ...snapshot.entities.flatMap((entity) =>
      entity.source_memory_ids.map((memoryId) => ({ from: memoryId, to: entity.entity_id, relationship: "mentions" as const }))
    )
  ];
  return {
    graph_id: "graph_lifeos_default",
    nodes: dedupeBy(nodes, (node) => node.id),
    edges: dedupeBy(edges, (edge) => `${edge.from}:${edge.to}:${edge.relationship}`),
    created_at: new Date().toISOString()
  };
}

export function projectContext(db: LifeOSStorage, projectIdOrName: string) {
  const graph = buildEntityGraph(db);
  const entity = db.lifeEntities.values().find((item) => item.entity_id === projectIdOrName || item.name.toLowerCase() === projectIdOrName.toLowerCase());
  if (!entity) {
    throw notFound("Project entity not found");
  }
  const entityMemoryIds = new Set(entity.source_memory_ids);
  const objects = db.lifeObjects
    .values()
    .filter(
      (object) =>
        object.related_entity_ids.includes(entity.entity_id) || object.source_memory_ids.some((memoryId) => entityMemoryIds.has(memoryId))
    );
  const memoryIds = new Set([...entity.source_memory_ids, ...objects.flatMap((object) => object.source_memory_ids)]);
  const memories = db.memoryItems.values().filter((memory) => memoryIds.has(memory.memory_id));
  return {
    project: entity,
    context: {
      decisions: objects.filter((object) => object.object_type === "decision"),
      tasks: objects.filter((object) => object.object_type === "task"),
      commitments: objects.filter((object) => object.object_type === "commitment"),
      memories,
      graph_edges: graph.edges.filter((edge) => edge.from === entity.entity_id || edge.to === entity.entity_id || memoryIds.has(edge.from))
    }
  };
}

function entityNode(entity: LifeEntity) {
  return {
    id: entity.entity_id,
    type: "entity" as const,
    label: entity.name,
    privacy_level: entity.privacy.privacy_level
  };
}

function memoryNode(memory: MemoryItem) {
  const privacyLevel = String(memory.privacy.privacy_level ?? "unknown") as PrivacyLevel;
  return {
    id: memory.memory_id,
    type: "memory" as const,
    label: memory.title,
    privacy_level: privacyLevel
  };
}

function dedupeBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
