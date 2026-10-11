# Contributing to MCP Advisor

[English](./CONTRIBUTING.md) | [Simplified Chinese](./CONTRIBUTING.zh-CN.md)

Thank you for contributing to MCP Advisor! This guide covers development setup,
code conventions, testing, commits, pull requests, and releases.

## Translation and Current-Source Updates

This English counterpart retains the sections of the [Chinese guide](./CONTRIBUTING.zh-CN.md),
with corrections checked against the current repository. Commands and examples
were reviewed against source, not validated by installing dependencies or running
the application. The Chinese original may still contain older instructions.

Important corrections are explained where they apply:

- Use the build-and-run workflow: there is no `dev` script in [package.json](./package.json).
- The CLI does not automatically load `.env`; export variables before launch or
  explicitly preload the installed `dotenv` package.
- Logging requires the current logger settings and an existing directory.
  Vector-engine configuration does not select the CLI's search providers.
- Test examples use current types and paths. The default Vitest suite includes
  both unit and integration tests.
- The actual hooks run type checking at pre-commit and commitlint at commit-msg;
  linting and tests remain explicit contributor checks.
- Release instructions avoid creating a second tag after a version command that
  already creates one.

For implementation context, see the [Architecture Guide](./docs/ARCHITECTURE.md),
[Technical Reference](./docs/TECHNICAL_REFERENCE.md), and repository guidance in
[AGENT.md](./AGENT.md) and [CLAUDE.md](./CLAUDE.md). When older prose disagrees with
checked-in scripts or types, use the current source references below.

## Contents

- [Development Setup](#development-setup)
- [Code Conventions](#code-conventions)
  - [TypeScript Best Practices](#typescript-best-practices)
  - [Functional Programming Principles](#functional-programming-principles)
  - [Naming Conventions](#naming-conventions)
  - [Path Handling Best Practices](#path-handling-best-practices)
- [Testing Guide](#testing-guide)
- [Error Handling Best Practices](#error-handling-best-practices)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)
- [Security and Quality Checklist](#security-and-quality-checklist)
- [Development Reminders](#development-reminders)
- [Getting Help](#getting-help)

## Development Setup

### Prerequisites

- **Node.js**: the repository's [.nvmrc](./.nvmrc) pins `18.18.0`.
  The original guide says Node.js 18 or later; this pin records the repository's
  baseline, not a claim that every newer release has been tested.
- **pnpm**: [package.json](./package.json) specifies `pnpm@8.15.9`.
- **Git**
- A POSIX-compatible shell for the checked-in shell scripts and build command's
  `chmod` step; Windows contributors can use an appropriate Linux environment.

### Clone the Repository

```bash
git clone https://github.com/istarwyh/mcpadvisor.git
cd mcpadvisor
```

If you use nvm, select the checked-in Node.js version with `nvm use` after making
that version available locally.

### Install Dependencies

```bash
pnpm install
```

The `preinstall` script enforces pnpm, and the `prepare` script initializes Husky.

### Configure Environment Variables

Set variables in the shell that launches the application. These examples use
POSIX shell syntax; use your shell's equivalent on other platforms.

```bash
export NODE_ENV=development
export TRANSPORT_TYPE=stdio

# Optional debug file logging
mkdir -p logs
export ENABLE_FILE_LOGGING=true
export LOG_LEVEL=debug
export LOGS_DIR="$PWD/logs"
```

[The entry point](./src/index.ts) reads `TRANSPORT_TYPE` (`stdio`, `sse`, or
`rest`), `SERVER_PORT` (default `3000`), `SERVER_HOST` (default `localhost`), and
`ENDPOINT` (REST path, default `/rest`). Command-line values take precedence for
these settings. The SSE path is `/sse`; its message path defaults to `/messages`
and is configurable through the `messagePath` command-line parameter.

**Correction to the original `.env` recipe:** merely creating `.env` does not
load it into the CLI process. You can put the same settings into a local `.env`
file without the `export` prefixes, then explicitly preload dotenv after building:

```bash
mkdir -p logs
node -r dotenv/config build/index.js
```

Do not commit secrets. `.env` is ignored by [.gitignore](./.gitignore).

[The logger](./src/utils/logger.ts) uses `ENABLE_FILE_LOGGING=true`, `LOG_LEVEL`,
and `LOGS_DIR`. Its ordinary CLI path only attaches file transports if the
selected directory already exists. `DEBUG=true` alone does not enable it.
Keep console logging disabled for stdio transport so logs do not contaminate
MCP protocol output.

For work specifically on vector engines, the
[factory](./src/services/vectorEngineFactory.ts) supports `memory`, `oceanbase`,
and `meilisearch`:

```bash
export VECTOR_ENGINE_TYPE=memory
```

This is an explicit development choice, not the configured default:
[constants.ts](./src/config/constants.ts) defaults to `oceanbase`, and the
factory falls back to memory if `OCEANBASE_URL` is missing. OceanBase work
requires your own connection string in `OCEANBASE_URL`; never put real credentials
in examples or commits. This setting does not replace the provider list in the
CLI, which initializes Meilisearch, Compass, and GetMCP, conditionally adds
Nacos, and uses SearchService's offline fallback. See the
[Technical Reference](./docs/TECHNICAL_REFERENCE.md) for provider settings.

### Build the Project

```bash
pnpm run build
```

This runs TypeScript compilation and marks `build/index.js` executable.
[tsconfig.json](./tsconfig.json) maps `src/` to `build/` and excludes test files
from the production build.

### Run the Development Server

```bash
# Build again after changing source files, then start the compiled CLI
pnpm run build
node build/index.js
```

There is no `pnpm run dev` script in the current package. Stdio mode waits for an
MCP client; silence alone does not indicate failure. To develop against REST:

```bash
TRANSPORT_TYPE=rest SERVER_HOST=localhost SERVER_PORT=3000 ENDPOINT=/rest node build/index.js
```

From another terminal, check the HTTP transport:

```bash
curl http://localhost:3000/health
```

A health response does not verify external search providers. Keep development
HTTP services on localhost unless you have appropriate network restrictions and
an authenticated proxy.

### Project Structure

```text
mcpadvisor/
├── .github/                 # GitHub workflows and configuration
├── .husky/                  # Git hooks
├── config/                  # Data-loading configuration and related utilities
├── data/                    # Bundled data
├── docs/                    # Documentation
├── src/
│   ├── config/              # Runtime constants and configuration loaders
│   ├── services/
│   │   ├── core/            # Search, installation, and MCP server logic
│   │   ├── providers/       # Backend-specific implementations
│   │   ├── common/          # Shared API, cache, and vector utilities
│   │   └── interfaces/      # Service interfaces
│   ├── types/               # Shared TypeScript types
│   ├── utils/               # Utilities
│   └── tests/
│       ├── unit/            # Unit tests
│       ├── integration/     # Integration tests
│       └── fixtures/        # Test data
├── tests/
│   ├── e2e/                # Playwright end-to-end tests
│   └── helpers/            # End-to-end test helpers
├── scripts/                 # Automation, including e2e/ and meilisearch/
├── package.json
└── tsconfig.json
```

The original guide's `src/tests/e2e/` directory does not exist in this checkout;
Playwright tests live under `tests/e2e/`.

## Code Conventions

### Code Style and Formatting

Follow [.prettierrc.mjs](./.prettierrc.mjs):

- Use two spaces for indentation and aim for an 80-character line width.
- Use template strings for interpolation.
- End statements with semicolons.
- Prefer single quotes; use double quotes in JSX.
- Use trailing commas and LF line endings.

```bash
pnpm run lint
pnpm run format:check
pnpm run check
```

`check` runs lint and formatting checks, not TypeScript checking. The package's
format scripts target `src/**/*.ts`; for Markdown, explicitly run Prettier on
the documentation files you changed, for example:

```bash
pnpm exec prettier --check CONTRIBUTING.md
```

### TypeScript Best Practices

- Define clear parameter and return types.
- Avoid `any`; prefer `unknown` or specific types.
- Prefer interfaces for object shapes and use generics where they improve reuse.
- Distinguish nullability (`string | null`) from optionality (`value?: string`).
  These express different contracts; optional properties are valid in current
  types and are not a substitute for explicit `null`.
- Use enums or existing literal unions for finite sets of values.
- Use type guards to narrow types.
- Prefer named exports for new APIs while respecting existing module exports.
- Use `.js` extensions for relative imports in this ESM TypeScript project.

This source-aligned example uses the existing types rather than redefining an
incompatible `SearchOptions` interface:

```typescript
import type {
  SearchOptions,
  SearchProvider,
  MCPServerResponse,
} from './types/index.js';
import type { SearchParams } from './types/search.js';

export async function searchProvider(
  provider: SearchProvider,
  params: SearchParams,
  options: SearchOptions = {},
): Promise<MCPServerResponse[]> {
  const results = await provider.search(params);
  return results.slice(0, options.limit ?? 5);
}
```

The import paths above assume a module directly under `src/`. This small helper
illustrates typing and limiting results, not the full SearchService ranking
behavior. In the current [types](./src/types/index.ts), `limit` is optional.

### Functional Programming Principles

- Prefer pure functions and avoid unnecessary side effects.
- Return new objects rather than mutating inputs.
- Compose small functions for more complex behavior.
- Give each function a single responsibility.
- Use higher-order functions such as `map`, `filter`, and `reduce` appropriately.
- Avoid deeply nested control flow; use composition or clear async functions.

Illustrative, self-contained example:

```typescript
function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + value ** 2, 0),
  );
  return magnitude === 0 ? [...vector] : vector.map(value => value / magnitude);
}
```

This adds a zero-vector guard to the original conceptual example. Avoid combining
unrelated calculation, normalization, and filtering steps in one large function.

### Naming Conventions

- **Classes**: PascalCase, such as `OfflineDataLoader`.
- **Functions and methods**: camelCase, such as `loadFallbackData`.
- **Constants**: UPPER_SNAKE_CASE, such as `DEFAULT_FALLBACK_DATA_PATH`.
- **Variables**: camelCase, such as `serverResponses`.
- **Interfaces**: PascalCase; use an `I` prefix to distinguish an interface from
  a same-named class, as in `IVectorSearchEngine`.
- **Files**: the original guide recommends kebab-case for new files. Match the
  surrounding module's established convention; existing files also use camelCase
  and PascalCase. Do not rename unrelated files just to enforce a convention.

Existing public interfaces such as `SearchProvider` and `SearchOptions` do not
have an `I` prefix. Preserve their names when importing or implementing them.

### Path Handling Best Practices

- Use [pathUtils.ts](./src/utils/pathUtils.ts) for project-specific path handling.
- Check development, test, and production layouts.
- Handle ESM `import.meta.url` correctly.
- Avoid hardcoded absolute paths; resolve from known project or module locations.
- Use `path.join()` and `path.resolve()` for platform-specific separators.
- Provide sensible fallback paths where needed.

For example, from a file one directory below `src/`:

```typescript
import { getMcpServerListPath } from '../utils/pathUtils.js';

const dataPath = getMcpServerListPath(import.meta.url);
```

Avoid brittle directory traversal based on an assumed CommonJS `__dirname` in
ES modules.

## Testing Guide

### End-to-End Testing Improvements

The project includes Inspector/proxy cleanup, modular environment helpers, and
script-based startup. Prefer readiness checks over fixed sleeps when writing or
improving tests.

**Current script caveat:** [e2e.run.sh](./scripts/e2e/e2e.run.sh) kills processes
on ports `6274` and `6277` and uses `pkill -f "inspector"`. Run it only in an
isolated development environment where those processes can safely be stopped.
Its cleanup function exits with status zero, including some startup-failure
paths; inspect logs and Playwright results rather than treating a zero exit as
proof of success. These are existing behaviors, not guarantees of test stability.

### Test Structure

- Group related tests with `describe`; use `test` or `it` for individual cases.
- Follow Given-When-Then.
- Use `beforeEach` and `afterEach` for setup and cleanup.
- Verify behavior with assertions rather than `console.log`.

### Test Design Principles

- Test one responsibility per case.
- Include boundaries, null values, invalid input, and failure paths.
- Keep tests fast and independent.
- Save and restore environment variables to avoid cross-test pollution.
- Verify content quality and relevance, not just result counts.
- Use targeted mocks for unit tests. Avoid global network mocks that prevent
  integration tests from making real requests.
- Check external service health and use appropriate credentials before running
  integration suites.

### Test Types

#### Unit Tests

```bash
# Unit tests only
pnpm run test src/tests/unit/

# One existing test file
pnpm run test src/tests/unit/services/searchService.test.ts

# All Vitest tests matched by the configuration, including integration tests
pnpm run test

# Watch mode
pnpm run test:watch
```

The original guide labels `pnpm run test` as unit-only, but
[vitest.config.ts](./vitest.config.ts) includes matching test files throughout
`src/`. Use the directory filter when you need only unit tests.

#### Integration Tests

```bash
pnpm run test src/tests/integration/
pnpm run test:meilisearch:local
```

These can need running services and network access. Follow the
[Local Meilisearch Guide](./docs/MEILISEARCH_LOCAL.md) for that provider's setup.

#### End-to-End Tests

```bash
pnpm run test:e2e
pnpm run test:meilisearch:e2e
```

The first command runs [e2e.run.sh](./scripts/e2e/e2e.run.sh), which expects
`mcp-inspector` on PATH and Playwright's browser dependencies. The second runs
[e2e.meilisearch.sh](./scripts/e2e/e2e.meilisearch.sh). Review their service and
cleanup behavior before running them. The standard E2E script defaults to headed
mode; use `pnpm run test:e2e headless` to pass the headless mode to that script.

### Test Example

This example is intended for a file in `src/tests/unit/services/`. It uses the
current structured search parameters and response fields, and disables offline
fallback so a unit test does not depend on local fallback data. Unlike the
original illustration, it does not use an undefined `MockProvider` type or call
`search()` with a string against its public TypeScript overload.

```typescript
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SearchService } from '../../../services/searchService.js';
import type {
  MCPServerResponse,
  SearchProvider,
} from '../../../types/index.js';

describe('SearchService', () => {
  let service: SearchService;
  let mockProvider: SearchProvider;
  let originalLogLevel: string | undefined;

  beforeEach(() => {
    originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'error';

    const response: MCPServerResponse = {
      id: '1',
      title: 'Test server',
      description: 'A test search provider',
      sourceUrl: 'https://example.com/test-server',
      similarity: 1,
      score: 1,
    };
    mockProvider = {
      search: vi.fn().mockResolvedValue([response]),
    };
    service = new SearchService([mockProvider], { enabled: false });
  });

  afterEach(() => {
    if (originalLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = originalLogLevel;
    }
    vi.restoreAllMocks();
  });

  test('returns provider results for structured search parameters', async () => {
    // Given
    const params = { taskDescription: 'test query' };

    // When
    const results = await service.search(params);

    // Then
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('title', 'Test server');
    expect(mockProvider.search).toHaveBeenCalledWith(params);
  });
});
```

The environment save/restore demonstrates isolation; a logger already imported
at module load does not reconfigure itself when `LOG_LEVEL` later changes.
This documentation snippet has been checked against source signatures, not run
as a new test.

## Error Handling Best Practices

- Use specific error types when they convey meaningful information.
- Include useful context in messages without logging secrets.
- Propagate failures correctly rather than silently swallowing them.
- Handle asynchronous errors with `try/catch` or `.catch()`.
- Log enough detail for debugging through the existing logger.
- Return fallback results only when the caller's contract permits them.
- Return proper script exit codes: zero for success and nonzero for failure.

The original loading example is conceptual: `Data` and `HttpError` are not
provided by that snippet. This self-contained illustration makes that explicit
and leaves validation to a caller-supplied parser:

```typescript
import logger from './utils/logger.js';

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

async function loadData<T>(
  url: string,
  parse: (value: unknown) => T[],
): Promise<T[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new HttpError(
        `Request failed: ${response.status}`,
        response.status,
      );
    }
    const value: unknown = await response.json();
    return parse(value);
  } catch (error) {
    logger.error('Failed to load data', {
      message: error instanceof Error ? error.message : String(error),
    });
    return []; // Only if an empty fallback is valid for this caller.
  }
}
```

The logger import assumes a module directly under `src/`. Do not log URLs that
may contain passwords, tokens, or other secrets.

## Commit Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>[optional scope]: <Description>

[optional body]

[optional footer]
```

### Commit Types

The types allowed by [commitlint.config.js](./commitlint.config.js) are:

- `feat`: New functionality
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Formatting or other changes that do not alter code behavior
- `refactor`: Refactoring without a new feature or bug fix
- `perf`: Performance improvements
- `test`: New or corrected tests
- `build`: Build-system or dependency changes
- `ci`: CI configuration or script changes
- `chore`: Other changes outside source or test behavior
- `revert`: Revert a previous commit

`revert` is present in the actual configuration even though the original guide
omits it.

### Commit Message Requirements

- Use a lowercase valid type and a nonempty subject.
- Use sentence case for the description, beginning with a capital letter.
- Do not end the subject with a period.
- Separate the body and footer with blank lines when present.
- Keep body lines at most 100 characters, as configured.
- Aim for the original guide's recommended 72-character subject line. The local
  configuration does not explicitly set a 72-character header limit; it extends
  `@commitlint/config-conventional`, so inherited rules also apply.

### Commit Examples

Valid subject:

```text
feat(search): Add vector similarity search with Meilisearch
```

Invalid subjects:

```text
feat(search): add vector similarity search with Meilisearch
feature(search): Add vector similarity search
```

The first violates sentence case; the second uses an unsupported type.

Complete example:

```text
feat(search): Add vector similarity search with Meilisearch

Add a new provider for semantic similarity matching, with error handling
and fallback behavior.

- Implement the provider
- Add vector normalization utilities
- Include unit tests
- Update documentation

Closes #123
```

Use issue references only when they actually apply to the change.

### Pre-commit Hooks

The checked-in hooks are:

1. [.husky/pre-commit](./.husky/pre-commit): runs `npx tsc --noEmit`.
   Its test commands are commented out, and it does not run ESLint.
2. [.husky/commit-msg](./.husky/commit-msg): runs commitlint against the commit
   message supplied by Git.

This corrects the original guide's claim that all three checks run in pre-commit.
Run quality checks yourself rather than relying on hooks alone:

```bash
# Diagnose type errors
pnpm exec tsc --noEmit

# Check lint and formatting
pnpm run check

# Fix lint findings where appropriate, then review the diff
pnpm run lint:fix

# Confirm the production build
pnpm run build
```

If commitlint rejects a new commit, correct the message and retry it:

```bash
git commit -m "feat: Add new feature description"
```

A rejected commit has not created a new commit, so do not automatically use
`--amend`: it would modify the previous commit. Amend only when deliberately
correcting an existing commit and respecting the repository's history policy.

## Pull Request Process

### 1. Create a Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

For a bug fix, use a branch such as `fix/issue-description` instead.

### 2. Develop and Commit

Make your changes, add tests, and update affected documentation. Then run:

```bash
pnpm run check
pnpm run test
pnpm run build
```

Review the diff and stage only files intended for this change:

```bash
git diff
git add path/to/changed-file
git commit -m "feat: Add new feature"
```

Replace the example path and subject with your actual changes. This corrects the
original PR example's lowercase subject, which conflicts with commitlint.

### 3. Push and Open a Pull Request

```bash
git push origin feature/your-feature-name
```

Open the PR on GitHub. If contributing from a fork, push to your fork and target
the upstream repository's appropriate branch.

### 4. PR Checklist

- [ ] Tests pass (`pnpm run test`), with required services available.
- [ ] Lint checks pass (`pnpm run lint`).
- [ ] TypeScript formatting passes (`pnpm run format:check`).
- [ ] Changed documentation has been checked separately for formatting and links.
- [ ] The build succeeds (`pnpm run build`).
- [ ] Relevant documentation is updated.
- [ ] Appropriate tests cover the change.
- [ ] The PR description explains the changes and any verification limitations.
- [ ] Code follows the project's conventions and best practices.

### 5. Code Review

- Respond to review comments.
- Make necessary revisions.
- Ensure required CI checks pass before merging.

## Release Process

### Versioning

Use [Semantic Versioning](https://semver.org/):

- **MAJOR** (`X.0.0`): Incompatible API changes
- **MINOR** (`0.X.0`): Backward-compatible functionality
- **PATCH** (`0.0.X`): Backward-compatible fixes

### Release Steps

Releases are maintainer actions and publish a public package. Begin with a clean,
reviewed working tree and the correct npm account. The commands below describe
the workflow; they do not authorize a contributor to publish.

1. **Update the version**:

   ```bash
   pnpm version patch --no-git-tag-version
   ```

   Choose `minor` or `major` when appropriate. This workflow deliberately disables
   automatic version commits/tags so verification happens before tagging. Review
   the changed manifest and any lockfile changes.

2. **Run the full checks**:

   ```bash
   pnpm run check
   pnpm run test
   pnpm run test:e2e
   ```

   Run relevant provider suites as well. Inspect E2E results and logs, including
   the script exit-code caveat under [Testing Guide](#testing-guide).

3. **Build and inspect the package contents**:

   ```bash
   pnpm run build
   npm pack --dry-run
   ```

   Review [package.json](./package.json)'s `files` list and verify all required
   runtime files are included. The package has a `prepublishOnly` build hook;
   a dry run is a packaging check, not proof of runtime correctness.

4. **Commit the reviewed release changes and publish to npm**:

   Create a release commit using a sentence-case conventional subject, such as
   `chore(release): Prepare next release`, after reviewing and staging the actual
   version changes. An authorized maintainer can then publish:

   ```bash
   npm publish
   ```

   The package is `@xiaohui-wang/mcpadvisor` and its configured access is public.
   Confirm the intended version and package before publishing.

5. **Create and push the matching Git tag**:

   ```bash
   VERSION=$(node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version")
   git tag "v$VERSION"
   git push origin "v$VERSION"
   ```

   Ensure the tag points to the reviewed release commit and push that commit
   through the repository's approved branch workflow. Do not reuse the original
   guide's fixed `v1.0.0` example. If you instead used a version command that
   already created a commit and tag, verify and push that existing tag rather
   than creating it again.

## Security and Quality Checklist

Before submitting a PR:

- [ ] No hardcoded API keys, passwords, or tokens appear in code or documentation.
- [ ] Secrets come from environment variables or GitHub Secrets.
- [ ] Scripts return zero on success and nonzero on failure.
- [ ] Tests restore environment variables they modify.
- [ ] E2E tests use readiness checks rather than fixed waits.
- [ ] Assertions check result quality, not only quantity.
- [ ] Paths are portable and do not hardcode a developer's home directory.
- [ ] Interface and class names do not conflict.
- [ ] CI timeouts account for container startup; the original guide recommends
      up to 180 seconds where appropriate, not a universal test timeout.
- [ ] Container configuration requires real credentials instead of weak defaults.

## Development Reminders

- Update project structure and package metadata when adding required files.
- Use appropriate path resolution across platforms and execution contexts.
- Verify that required configuration files and dependencies are available in the
  built and packaged application.

## Getting Help

1. Read the [Quick Start Guide](./docs/GETTING_STARTED.md).
2. Check the [Troubleshooting Guide](./docs/TROUBLESHOOTING.md).
3. Consult the [Architecture Guide](./docs/ARCHITECTURE.md) and
   [Technical Reference](./docs/TECHNICAL_REFERENCE.md).
4. Search existing [GitHub issues](https://github.com/istarwyh/mcpadvisor/issues).
5. Open an issue with a clear description and redacted reproduction details if
   the existing documentation does not resolve the problem.

Thank you for helping improve MCP Advisor!
