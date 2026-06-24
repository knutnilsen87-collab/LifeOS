import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      LIFEOS_STORAGE_DRIVER: "memory"
    },
    globals: true,
    include: ["tests/**/*.test.ts"]
  }
});
