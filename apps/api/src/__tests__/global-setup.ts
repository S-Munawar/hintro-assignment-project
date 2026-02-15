/**
 * Jest global setup — runs once before all test suites.
 * Ensures the test database is ready with up-to-date schema.
 */
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

export default async function globalSetup() {
  // Set test environment
  process.env.NODE_ENV = "test";

  // Run Prisma migrations against the test database
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const apiRoot = path.resolve(__dirname, "../..");
  execSync("npx prisma migrate deploy", {
    cwd: apiRoot,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "test" },
  });
}
