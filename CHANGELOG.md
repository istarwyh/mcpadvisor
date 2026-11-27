# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0]

- Support the MCP 2026-07-28 protocol via stdio and stateless HTTP. Older clients must migrate; legacy SSE/REST endpoints are no longer supported.
- Add official MCP Registry ownership metadata for the npm package and a stdio registry manifest.

## [1.0.5] - 2025-07-12

### ✨ Added
- Add MCP resources functionality for log reading (20f23af)
- Add comprehensive smart Meilisearch E2E testing system (b14285d)
- Add comprehensive Meilisearch local integration (c6155b0)
- Add Nacos provider for MCP server discovery (75696f5, 52c41dc)
- Integrate real NacosHttpClient and update tests (e72a45f, e135beb)
- Enhance PR and issue handling workflows (6b5ac59)
- Add mseep badge (0c6158f, 888cced)
- Add keywords and capabilities search parameters (e4aae96, e8cce79, 296d29a, 7e89e0e)
- Add MCP server functionality (dbc809b, f302e18, 12718a2, 3f9f70c)
- Add Oceabase testing (fdf551d, f07909f)
- Add Smithery configuration and integration (6751a92, 344065a, 8ef42f1, 572f774)
- Add Docker support with VS Code integration (70fb569, 84ff2a8, 006045f, 2b3ce76)
- Add offline recommend functionality (e73edb7, d669693, 57e0290)

### 🐛 Fixed
- Fix Meilisearch spelling and configuration (2c9dbf4)
- Improve branch management in issue and pull-request workflows (3a7fa3f)
- Resolve test failures in installation guide service tests (41c520e)
- Address critical security and performance issues in mcp-resources (a2866bb)
- Remove [DEBUG] prefixes and improve logging documentation (0f007d2)
- Update .gitignore and remove tracked meilisearch data files (f10a159)
- Resolve Meilisearch integration test failures by fixing fetch mocking (1a42c9c)
- Improve local Meilisearch setup and testing infrastructure (e403690)
- Upgrade actions/upload-artifact from v3 to v4 (277b36b)
- Add pnpm installation step to GitHub Actions workflow (1a1eb96)
- Resolve CI test failures and security issues (3d979f6)
- Address code review security vulnerabilities and bugs (d6adafc)
- Remove test artifacts from repository and update .gitignore (9a7a01f, 8f4aa7d)
- Resolve variable name conflicts for Jest compatibility (cf77aef, 3a4ae1e)
- Include data directory in npm package (36de5a5)
- Resolve conflicts and add type definitions (5513f66)
- Add @types/node dependency to resolve process type error (f5a82a9)
- Remove need for OCEANBASE_URL (00fa1f1)

### 🔄 Changed
- Remove Docker deployment option, focus on binary installation (4a81e1f)
- Reorganize services directory and add comprehensive testing (4a30fc3, 6d6b0b5)
- Move service detail logic and error handling to NacosHttpClient (f0e5f91, 033863c)
- Reorganize Nacos and VectorDB modules (711ba81, 4539c8e)
- Add Rerank Processor and Service (a34f6fb, 96ee272, 1955d9d, d2c646d)
- Add SearchMcpFactory (0975d06, 74ac35c)
- Rename github_url to SourceUrl (5a98b31, 1eb0582)
- Refactor ServerService (a0be2cf, b3cb0ad, 91be8eb, e7970ef)
- Refactor offline search functionality (66986df, a010b8e, 1251274, f7f460c)
- Migrate test suite from Jest to Vitest with improved organization (bbb9482, bed85a0)
- Migrate to flat ESLint config and update dependencies (61feb32, c20d895)
- Use Prettier for code formatting (343d715, 15ddacd)
- Extract configuration guide logic to dedicated service (c1276d2)

### 📚 Documentation
- Move issue-6-mcp-resources-plan.md to proper tech directory (8915a97)
- Clean up README merge conflicts and content (0a77c67)
- Add Meilisearch testing best practices and integration troubleshooting (51e0a14)
- Add auto-commit guidelines to AGENT.md and CLAUDE.md (0cf7d6b)
- Add comprehensive test fixes documentation (0b2806c)
- Update development guides with code review best practices (adb1cb6)
- Update version to 1.0.5 (47c08ee, 2c94908)
- Add user story documentation (2bb7717, a3e3443, 7e05346, 33e61f4)
- Update README with badges and installation instructions (2840b1d, c507232, d9ebda6, f419609, 0d70a6d)
- Add roadmap and development guides (2140e06, d23c8d1, 832e126, a2c490f, 7583970, 59b697c)
- Add best practices documentation and contribution guide (afdfc65)
- Add English and Chinese README versions (ce1ebc5)
- Restructure documentation for better user and developer experience (63ab2df, b66cc79)
- Add Bilibili demo video to README (e087043)
- Enhance data flow diagram and consolidate search strategy (e266f04, c5703c4)
- Add comprehensive roadmap with focus on reinforcement learning (c46ba5d)
- Add comprehensive user and developer guides to README (ee31e27)

### 🧪 Tests
- Modify offline tests (6ba74ec, e913e6e, 20e4b64, c2272e5)
- Offline test improvements (6b169b6, c45043c, a77f572, dda6af9)
- Clean up tests and optimize dependency management (832e126, 5e1b637)

### 🏗️ Build & CI
- Remove frozen-lockfile flag in Dockerfile (ad5fd1f, d7210bc)
- Dockerfile pnpm install improvements (cd0ca2f, adf342a, 3b87b45, 0eb29cb, f3dd552, 5e3e473)
- Remove package-lock.json (2550b1b)
- Add gitattributes to handle package-lock.json conflicts (926317e)
- Remove shell env headers from husky git hook scripts (f5a82a9)

### 🧹 Maintenance
- Installation and setup improvements (d2c8cdd, b5a7d01)
- Clean up console logging (c06d281, c837ad1)
- Merge provider functionality (df00ed8)
- Optimize test configuration and merge test directories (2205eeb)
- Version updates and general maintenance (2c7dec3, d5d35d3)

### 📝 Other
- Multiple merge commits from pull requests #17, #14, #12, #11, #10, #5, #4, #3 (72a582a, 4f12b71, f5644b4, 4a9c53f, d89369d, a8e259d, 344f04a, 9a228fe, b96ef04, 2bea663, 2840b1d, 2348384, e5026b7)
- Style changes and name adjustments (df00ed8, 2205eeb)
- Data update mechanism implementation (c90466d, 2ddfaf1, 0c039d4)
- Enhance embedding system with TensorFlow.js and Universal Sentence Encoder (19b83f3)
- Add parameter configuration for transport modes (811bd38)

---

**Total Changes**: 180 commits since v1.0.3 including major new features, bug fixes, documentation improvements, and infrastructure enhancements.

**Key Highlights**:
- 🔍 Complete Meilisearch integration for advanced search capabilities
- 🌐 New Nacos provider for service discovery
- 📋 Enhanced MCP resources functionality with log reading
- 🧪 Comprehensive E2E testing system
- 📚 Improved documentation and developer guides
- 🔧 Better CI/CD pipeline and build process
- 🐛 Multiple security and performance fixes