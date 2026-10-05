# Branch Mind

**A learning path for the course. A separate branch for every question.**

Branch Mind is an AI learning workspace with automatically generated course chapters, nested topics, independent Q&A, and shared notation. Version **0.1.1** is a web application and installable PWA built on [Prompt Tree](https://github.com/yxp934/Prompt-Tree).

[中文说明](README.zh-CN.md) · [Detailed usage and deployment](ai-chat-client/docs/BRANCH_MIND.md) · [Changelog](CHANGELOG.md)

## Features

- **Topic first:** enter a subject, what you want to learn, and what you already know. AI plans chapters and prerequisite coverage from this profile. You can update it in the course note settings.
- **Automatic refinement:** select a chapter and create subtopics without writing another prompt. There is no fixed topic-depth limit. Model leaf suggestions never prevent further refinement, and specific topics also offer “Start learning”.
- **Independent Q&A:** free input opens a question branch from the current lesson. Follow-up questions stay there, while the learning path retains its position.
- **Lecture styles:** rigorous, intuitive, concise, and custom, with optional Chinese/English terminology and per-lecture overrides. Markdown and LaTeX formulas are supported.
- **Course continuity:** shared notation, confirmed study notes, and bounded references to earlier lectures are included in later lessons. Raw Q&A is kept in its own branch.
- **DeepSeek by default:** configure your own API key in Settings. Other OpenAI-compatible providers are supported.
- **Portable study data:** local IndexedDB storage, JSON backup/restore, and optional authenticated server synchronization with revision conflict checks.
- **Desktop and mobile:** responsive light/dark interface and PWA support for compatible browsers on Windows, macOS, and Android.

## Quick start

Requires **Node.js 22+** and npm.

```sh
git clone https://github.com/SuiYueMengHen/BranchMind.git
cd BranchMind/ai-chat-client
npm ci
npm run dev
```

Open **http://localhost:1666**, add your API key in **Settings**, then create a learning topic. No API key or user study data is bundled.

For production:

```sh
npm run build
npm start
```

Keep using the same hostname and port: `localhost` and `127.0.0.1` have separate browser storage. The Node server must be running for model requests. The CLI also accepts `npm start -- --port 1666`.

## Workflow

1. Create a topic such as quantum mechanics, describe your learning goal and prior knowledge (or explicitly state no prior knowledge), and confirm.
2. Choose an automatically generated chapter.
3. Create subtopics, or start learning when the topic is specific enough.
4. Type a question in the bottom composer to open independent Q&A.
5. Return to the chapter to continue learning. Confirm important notes before sharing them with the course.

## Installation and synchronization

Install through your browser's PWA installation entry. HTTPS is required outside localhost. This release does **not** include native EXE, DMG, or APK packages.

Cross-device synchronization needs a server reachable by all devices, HTTPS, a persistent data directory, and a random `BRANCH_MIND_SYNC_TOKEN` of at least 24 characters. A configured token protects the learning workspace and model/tool routes. Upload/download is manual; stale uploads are rejected, and concurrent changes are not automatically merged. API keys and provider settings are not synchronized.

See the [deployment guide](ai-chat-client/docs/BRANCH_MIND.md) for configuration and backup instructions. The service is designed for one personal workspace. Public hosting should never expose an unprotected model/tool server. GitHub Pages alone cannot run the required Next.js API routes.

### Docker

```sh
cd ai-chat-client
docker compose up --build -d
```

The default Compose file binds to localhost and uses a persistent volume. Configure authentication and HTTPS before enabling remote access. Docker build/install and real Windows/Android device installation have not been verified for this release.

## Data and privacy

Study content is stored locally in your browser; API keys are stored separately in localStorage and are sent to the configured server/provider for requests. The server can read model credentials and request content; this is not an end-to-end encrypted system. Optional sync stores study snapshots on the server, and your chosen model provider receives the request context.

Backups omit provider credentials, but secrets typed into messages or notes remain part of their text. Review backups before sharing them. Clearing browser data can remove local records, so keep backups.

Release snapshots exclude environment files, credentials, browser profiles/screenshots, study snapshots, request logs, and local live-test reports. The optional privacy checker requires Python 3. To check tracked release files:

```sh
cd ai-chat-client
npm run privacy:check
```

## Development

```sh
cd ai-chat-client
npm ci
npm run typecheck
npm run lint
npm run test:run
npm run build
```

The default test suite does not call paid model APIs. The opt-in live integration test requires an explicitly supplied private config file. Version 0.1.1 has 117 passing offline tests, including deep-topic navigation, refinement beyond twelve levels, and persistent learner profiles. Earlier live DeepSeek verification covers provider checks, streaming, chapter planning/refinement, lecture generation, and context continuity. Mathematical correctness still requires subject-specific review.

## Project layout

```text
ai-chat-client/
  src/app/             Next.js pages and API routes
  src/components/      Learning workspace and shared UI
  src/store/           Conversation, curriculum and provider state
  src/lib/             Storage, AI requests, memory and synchronization
  src/__tests__/       Offline and opt-in integration tests
  public/              PWA assets
  docs/                Usage and upstream attribution
```

## License and attribution

MIT. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY_NOTICES.md).

Based on Prompt Tree v0.7.0, commit `e96db4ef11a674d6ad9f298b75b52f24201da2a7`. Original documentation is retained in [UPSTREAM_README.md](ai-chat-client/docs/UPSTREAM_README.md). Existing `prompt-tree.*` storage keys are retained for compatibility. Branch Mind has its own version sequence beginning at 0.1.0.
