import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    include: ["test/**/*.test.ts"],
    setupFiles: ["dotenv/config"],
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/server.ts",
        "src/graphql/context.ts",
        "src/lib/prisma.ts",
        "src/**/*.d.ts"
      ]
    }
  }
});
