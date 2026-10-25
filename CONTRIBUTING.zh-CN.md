# MCP Advisor 贡献指南

[English](./CONTRIBUTING.md) | [简体中文](./CONTRIBUTING.zh-CN.md)

欢迎为 MCP Advisor 项目做出贡献！本文档提供了开发环境设置、代码规范、测试指南和提交流程的完整指导。

## 当前源码范围

本指南与英文版对应 2026-10-25 的源码 `94829fd`，不代表 npm `1.0.5` 发布产物或托管服务。应遵循实际脚本，区分文档示例与真正执行的验证；英文 `.en.md` 是英文主文件镜像。

## 目录

- [开发环境设置](#开发环境设置)
- [代码规范](#代码规范)
  - [TypeScript 最佳实践](#typescript-最佳实践)
  - [函数式编程原则](#函数式编程原则)
  - [命名约定](#命名约定)
  - [路径处理最佳实践](#路径处理最佳实践)
- [测试指南](#测试指南)
- [错误处理最佳实践](#错误处理最佳实践)
- [提交规范](#提交规范)
- [PR 流程](#pr-流程)
- [发布流程](#发布流程)

## 开发环境设置

### 前提条件

- **Node.js** (>= 20；`.nvmrc` 选择 Node.js 22 用于开发和 CI)
- **pnpm** (8.15.9) - 项目使用 pnpm 作为包管理器
- **Git**

### 克隆仓库

```bash
git clone https://github.com/istarwyh/mcpadvisor.git
cd mcpadvisor
```

### 安装依赖

```bash
pnpm install --frozen-lockfile
```

### 配置环境变量

CLI 不会自动加载 `.env` 或 `.mcpadvisorrc`。请在启动前导出变量，或显式预加载 `dotenv`。

```bash
mkdir -p logs
export TRANSPORT_TYPE=stdio
export ENABLE_FILE_LOGGING=true
export LOGS_DIR="$PWD/logs"
```

`DEBUG=true` 不是日志开关。向量引擎配置不选择 CLI 提供者；Nacos 需要地址、用户名、密码三者齐全。完整配置与协议边界见[快速开始](./docs/GETTING_STARTED.zh-CN.md)。

### 构建项目

```bash
pnpm run build
```

### 运行开发服务器

```bash
# package.json 没有 dev 脚本；先构建再运行
node build/index.js
```

### 项目结构

```
mcpadvisor/
├── .github/            # GitHub 工作流和配置
├── .husky/             # Git hooks
├── docs/               # 文档
├── src/                # 源代码
│   ├── config/         # 配置相关
│   ├── services/       # 核心服务
│   │   ├── core/       # 核心业务逻辑
│   │   ├── providers/  # 外部服务提供者
│   │   ├── common/     # 共享工具
│   │   └── interfaces/ # 类型定义
│   ├── types/          # TypeScript 类型定义
│   ├── utils/          # 工具函数
│   └── tests/          # 测试文件
│       ├── unit/       # 单元测试
│       └── integration/# 集成测试
├── tests/              # E2E 测试 (Playwright)
├── scripts/            # 自动化脚本
├── package.json        # 项目配置
└── tsconfig.json       # TypeScript 配置
```

## 代码规范

### 代码风格与格式

- **缩进**: 使用 2 个空格缩进
- **行长度**: 尽量保持在 80 个字符以内
- **字符串**: 优先使用模板字符串 `` `${variable}` ``
- **分号**: 语句末尾使用分号
- **引号**: 优先使用单引号 `'`，JSX 中使用双引号 `"`

### TypeScript 最佳实践

- **类型安全**: 始终为函数参数和返回值定义类型
- **避免 `any`**: 尽量避免使用 `any` 类型，使用 `unknown` 或具体类型
- **接口优于类型别名**: 对于对象类型，优先使用接口而非类型别名
- **可空类型**: 区分显式 `string | null` 与可选属性；两者表达不同契约
- **枚举**: 对于有限集合的值，使用枚举类型
- **类型守卫**: 使用类型守卫进行类型收窄
- **泛型**: 适当使用泛型提高代码复用性和类型安全性
- **导入/导出**: 使用命名导出而非默认导出，保持一致性

以下示例使用现有类型；假设文件位于 `src/`。它仅演示类型和结果上限，不代表完整服务的排序行为；当前 `SearchOptions.limit` 为可选属性。

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

### 函数式编程原则

- **纯函数**: 尽量使用纯函数，避免副作用
- **不可变性**: 避免修改传入的参数，返回新对象
- **函数组合**: 使用小函数组合成复杂功能
- **单一职责**: 每个函数只做一件事
- **高阶函数**: 适当使用高阶函数如 `map`, `filter`, `reduce`
- **避免深度嵌套**: 使用函数组合或 Promise 链避免回调地狱

以下是自包含的函数示例，包含零向量保护；避免在同一个函数中混杂计算、归一化和过滤等职责。

```typescript
function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + value ** 2, 0),
  );
  return magnitude === 0 ? [...vector] : vector.map(value => value / magnitude);
}
```

### 命名约定

- **类名**: 使用 PascalCase (如 `OfflineDataLoader`)
- **函数/方法名**: 使用 camelCase (如 `loadFallbackData`)
- **常量**: 使用 UPPER_SNAKE_CASE (如 `DEFAULT_FALLBACK_DATA_PATH`)
- **变量**: 使用 camelCase (如 `serverResponses`)
- **接口名**: 使用 PascalCase 并以 `I` 开头 (如 `IVectorSearchEngine`)
- **文件名**: 使用 kebab-case (如 `offline-data-loader.ts`)

### 路径处理最佳实践

- **统一工具**: 使用 `pathUtils.ts` 处理所有路径相关操作
- **环境兼容**: 确保路径处理在不同环境（开发、测试、生产）中都能正常工作
- **ESM 兼容**: 处理 `import.meta.url` 在不同环境中的兼容性
- **相对路径**: 避免硬编码绝对路径，使用相对路径和项目根目录
- **路径分隔符**: 使用 `path.join()` 和 `path.resolve()` 处理路径分隔符
- **备用路径**: 提供备用路径机制，增强可靠性

```typescript
// 好的实践
import { getMcpServerListPath } from '../utils/pathUtils.js';
const dataPath = getMcpServerListPath(import.meta.url);

// 避免的实践
const dataPath = path.resolve(__dirname, '../../../../data/file.json');
```

## 测试指南

### 端到端测试改进

当前 [e2e.run.sh](./scripts/e2e/e2e.run.sh) 保留失败退出码，只清理自己创建的进程组；可用 `lsof` 时发现 `6274`/`6275` 已占用会拒绝启动，不会杀死无关进程。私有日志可能含认证令牌，不要公开日志或跟踪文件。编写测试应使用就绪检查，而不是固定等待。

### 测试结构

- 使用 `describe` 组织相关测试，`test`/`it` 用于具体测试用例
- 遵循 Given-When-Then 模式
- 使用 `beforeEach`/`afterEach` 进行设置和清理
- 使用断言而非 `console.log` 进行验证

### 测试设计原则

- **单一职责**: 每个测试应验证一个功能
- **边界值测试**: 测试边界值、空值、无效输入
- **错误处理**: 明确测试错误条件和异常处理
- **性能**: 测试应快速执行
- **环境隔离**: 在 beforeEach/afterEach 中保存/恢复环境变量
- **内容验证**: 验证结果内容的相关性，而不仅仅是数量
- **网络请求**: 避免全局模拟，防止阻塞集成测试

### 测试类型

#### 单元测试
```bash
# 只运行单元测试
pnpm run test src/tests/unit/

# 默认 Vitest 范围含单元与集成测试
pnpm run test

# 运行特定测试文件
pnpm run test src/tests/unit/services/searchService.test.ts

# 监视模式
pnpm run test:watch
```

#### 集成测试
```bash
# 运行集成测试
pnpm run test src/tests/integration/

# Meilisearch 集成测试
pnpm run test:meilisearch:local
```

#### 端到端测试

Inspector 2.10.1 需要 Node.js **22.19.0 或更新版本**。脚本用 `npx` 获取固定版本，不要求全局安装 Inspector。预先安装 Playwright Chromium 及系统依赖；禁用安装脚本时还需处理 `sharp` 原生依赖，详见 [Inspector 指南](./docs/inspector-ui-testing.md)。

```bash
# 确定性离线协议测试
pnpm run test:protocol
# 仅已迁移的 Inspector 测试文件
pnpm run test:e2e headless tests/e2e/mcp-inspector.spec.ts
# 默认完整选择（有界面）
pnpm run test:e2e
# 独立本地 Meilisearch 测试脚本
pnpm run test:meilisearch:e2e
```

指定文件通过不等于旧 Meilisearch UI 测试、真实提供者质量、托管服务或第三方客户端均验证通过。直接运行 `test:e2e:headless` 不会替你启动测试服务。运行独立脚本前检查服务和清理行为。

### 测试示例

示例适用于 `src/tests/unit/services/` 下的文件，使用当前结构化搜索参数及响应字段，并关闭离线兜底以隔离测试数据。

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

环境变量保存/恢复展示测试隔离；模块加载时已初始化的日志器不会因之后改变 `LOG_LEVEL` 而自动重配。该片段已对照源码签名核查，未作为新测试执行。

## 错误处理最佳实践

- **具体错误类型**: 使用具体错误类型而非通用 `Error`
- **有用的错误消息**: 提供带上下文的有用错误消息
- **错误传播**: 正确传播错误，不要忽略
- **异步错误**: 使用 `try/catch` 或 Promise `.catch()` 处理异步错误
- **错误日志**: 记录错误详情以便调试
- **优雅降级**: 尽可能提供优雅的降级方案
- **脚本退出码**: 脚本必须返回适当的退出码（成功 0，失败 1+）

下例为错误处理概念草图，`Data`、`url`、`HttpError`、`logger` 需由调用方定义，不是可直接运行的代码。只有明确允许降级时才应返回空结果。

```typescript
// 好的实践
async function loadData(): Promise<Data[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new HttpError(`Request failed: ${response.status}`, response.status);
    }
    return await response.json();
  } catch (error) {
    logger.error('Failed to load data', { error, url });
    return []; // 优雅的降级
  }
}
```

## 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

### 提交类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档变更
- `style`: 代码格式变更（格式化等）
- `refactor`: 代码重构
- `perf`: 性能改进
- `test`: 添加或修复测试
- `build`: 构建系统或依赖变更
- `ci`: CI 配置变更
- `chore`: 其他不修改 src 或 test 文件的变更

### 提交消息格式要求

**重要**: 项目配置了 commitlint 预提交钩子，确保提交消息符合规范：

- **主题行格式**: `<type>[optional scope]: <Description>` (注意首字母大写)
- **类型**: 必须是有效的 conventional commit 类型
- **描述**: 首字母必须大写，使用句子格式 (sentence-case)
- **长度**: 主题行不超过 72 个字符

### 提交示例

```text
# ✅ 正确格式
feat(search): Add vector similarity search with Meilisearch

# ❌ 错误格式 - 描述首字母未大写
feat(search): add vector similarity search with Meilisearch

# ❌ 错误格式 - 无效类型
feature(search): Add vector similarity search

# ✅ 完整示例
feat(search): Add vector similarity search with Meilisearch

Add new vector search provider that integrates with Meilisearch
for semantic similarity matching. Includes proper error handling
and fallback mechanisms.

- Implement MeilisearchProvider class
- Add vector normalization utilities
- Include comprehensive unit tests
- Update documentation

Closes #123
```

### Pre-commit 钩子

实际钩子：

1. [.husky/pre-commit](./.husky/pre-commit) 运行 `npx tsc --noEmit`；测试命令已注释，不运行 ESLint。
2. [.husky/commit-msg](./.husky/commit-msg) 用 commitlint 检查提交消息。

lint 和测试需要显式运行，不应仅依赖提交钩子。

如果遇到提交被拦截的情况：

```bash
# 如果类型检查失败
pnpm run check
pnpm run build

# 如果 lint 检查失败
pnpm run lint:fix

# 如果提交消息格式错误，修正后重新提交
git commit -m "feat: Add new feature description"
```

## PR 流程

### 1. 创建分支

```bash
# 从 main 分支创建功能分支
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# 或 bugfix 分支
git checkout -b fix/issue-description
```

### 2. 开发和提交

```bash
# 进行更改
# ...

# 运行测试和检查
pnpm run check
pnpm run test
pnpm run build

# 提交更改
git add .
git commit -m "feat: Add new feature"
```

### 3. 推送和创建 PR

```bash
# 推送到远程仓库
git push origin feature/your-feature-name

# 在 GitHub 上创建 Pull Request
```

### 4. PR 检查清单

在提交 PR 之前，确保：

- [ ] 所有测试通过 (`pnpm run test`)
- [ ] 代码风格检查通过 (`pnpm run lint`)
- [ ] 代码格式正确 (`pnpm run format:check`)
- [ ] 构建成功 (`pnpm run build`)
- [ ] 更新了相关文档
- [ ] 添加了适当的测试
- [ ] PR 描述清楚说明了变更内容
- [ ] 遵循了代码规范和最佳实践

### 5. 代码审查

- 响应审查意见
- 进行必要的修改
- 确保 CI 检查通过

## 发布流程

### 版本号规范

使用 [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): 不兼容的 API 变更
- **MINOR** (0.X.0): 向后兼容的功能新增
- **PATCH** (0.0.X): 向后兼容的 Bug 修复

### 发布步骤

仅在获得该版本发布授权后，由维护者执行。文档维护或普通合并不自动授权发布。

1. 在干净分支核对目标提交、版本、发布说明和 registry。
2. 执行 `pnpm run check`、`pnpm run test`、所需 E2E、`pnpm run build` 与 `npm pack --dry-run`；记录失败、跳过及明确接受的验证缺口。
3. 使用 `pnpm version patch --no-git-tag-version`（或经确认的 minor/major）更新版本，核查 manifest/锁文件，再创建经过审查的版本提交。该选项不自动创建标签。
4. 核对实际生成的包与版本提交，再按项目授权推送并执行 `npm publish`；使用实际包版本创建并推送匹配标签。若改用自动创建提交和标签的版本命令，应复用该标签，不能重复创建。不得扩展凭据权限或绕过保护。
5. 从 registry 回读发布版本并验证安装；单独记录源码合并、包发布与部署状态，不把发布当成部署。

## 安全和质量检查清单

提交 PR 前的安全质量检查：

- [ ] 代码或文档中没有硬编码的 API 密钥、密码或令牌
- [ ] 所有机密信息使用环境变量或 GitHub Secrets
- [ ] 脚本返回适当的退出码（成功 0，失败 1+）
- [ ] 测试保存/恢复环境变量以防止污染
- [ ] E2E 测试使用智能等待机制而非固定超时
- [ ] 验证测试结果内容质量，而不仅仅是数量
- [ ] 脚本中使用相对路径以实现跨平台兼容性
- [ ] 接口和类名不冲突（使用 `IClassName` 模式）
- [ ] CI 超时适合容器操作（推荐 180s）
- [ ] Docker 配置使用必需的环境变量，而非弱默认值

## 开发备忘录

- 始终添加必要的文件到 package.json 和项目结构
- 使用适当的路径解析以实现跨平台兼容性
- 确保配置文件和依赖项包含在构建中

## 获取帮助

如果您在贡献过程中遇到问题：

1. 查看 [快速开始指南](docs/GETTING_STARTED.md)
2. 查看 [故障排除文档](docs/TROUBLESHOOTING.md)
3. 搜索现有的 [GitHub Issues](https://github.com/istarwyh/mcpadvisor/issues)
4. 创建新的 Issue 描述您遇到的问题

感谢您对 MCP Advisor 的贡献！您的参与使这个项目变得更好。
