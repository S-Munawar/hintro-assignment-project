/**
 * Jest setup file — runs before each test suite.
 * Sets NODE_ENV to "test" so the server doesn't .listen().
 */
process.env.NODE_ENV = "test";
