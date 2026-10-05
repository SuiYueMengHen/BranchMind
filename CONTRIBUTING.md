# Contributing

Use Node.js 22+ and run `npm ci` from `ai-chat-client/`. Before proposing a change, run `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run build`.

Use fictional course data and mock credentials in tests. Never include real keys, environment files, browser profiles, study exports, sync snapshots, or request logs in a commit. Run `npm run privacy:check` after staging your changes.

Report reproducible bugs through GitHub Issues. Include your Node version and sanitized error code, but omit request headers and private conversations. Live model integration tests are opt-in and can consume paid API credits; normal tests are offline.
