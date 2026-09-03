import { defineConfig } from "vitest/config";

// Only the pure lib modules run here: the same date, delta and passport rules as the web client.
export default defineConfig({ test: { include: ["src/lib/**/*.test.ts"] } });
