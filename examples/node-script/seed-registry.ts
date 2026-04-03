/**
 * Example: Standalone script to seed the typed-fetch registry.
 *
 * This is the CI seeding pattern:
 *   1. Make representative requests against a real or test server.
 *   2. Flush all pending observations to the registry file.
 *   3. Generate types from the populated registry.
 *
 * Run this before your type-check step so that generated types are
 * always up to date with the real API shapes.
 *
 * Usage:
 *   npx tsx examples/node-script/seed-registry.ts
 */

import { typedFetch, flushObservations, generateTypes } from "@phumudzo/typed-fetch";

async function seed(): Promise<void> {
  console.log("Seeding registry...");

  // Fetch representative examples of each endpoint.
  // Use real IDs from your test/staging environment.

  await typedFetch(
    "https://jsonplaceholder.typicode.com/users/1",
    { method: "GET" },
    { endpointKey: "GET /users/:id" },
  );

  await typedFetch(
    "https://jsonplaceholder.typicode.com/posts",
    { method: "GET" },
    { endpointKey: "GET /posts" },
  );

  await typedFetch(
    "https://jsonplaceholder.typicode.com/posts/1",
    { method: "GET" },
    { endpointKey: "GET /posts/:id" },
  );

  await typedFetch(
    "https://jsonplaceholder.typicode.com/posts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Seed post", body: "Content", userId: 1 }),
    },
    { endpointKey: "POST /posts" },
  );

  // Flush all pending observations from the queue to the registry file.
  // This must be called before generateTypes() in scripts that exit immediately.
  await flushObservations();
  console.log("Observations flushed to registry.");

  // Generate the TypeScript declaration file from the registry.
  const result = generateTypes();
  console.log("Types written to:", result.outputPath);

  for (const warning of result.warnings) {
    console.warn("Warning:", warning);
  }
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
