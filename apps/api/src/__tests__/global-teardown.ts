/**
 * Jest global teardown — runs once after all test suites.
 */
export default async function globalTeardown() {
  // Nothing to do — the database remains for inspection if needed.
  // CI pipelines can drop the DB after the run.
}
