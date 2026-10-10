# MCP Advisor 贡献指南

[English](./CONTRIBUTING.en.md) | [简体中文](./CONTRIBUTING.zh-CN.md)

欢迎为 MCP Advisor 项目做出贡献！本文档提供了开发环境设置、代码规范、测试指南和提交流程的完整指导。

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

- **Node.js** (>= 18.x)
- **pnpm** (>= 9.x) - 项目使用 pnpm 作为包管理器
- **Git**

### 克隆仓库

```bash
git clone https://github.com/istarwyh/mcpadvisor.git
cd mcpadvisor
```

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

创建 `.env` 文件：

```bash
# 开发模式
NODE_ENV=development

# 传输类型 (stdio, sse, rest)
TRANSPORT_TYPE=stdio

# 日志配置
DEBUG=true
ENABLE_FILE_LOGGING=true
LOG_LEVEL=debug

# 向量引擎类型 (memory, oceanbase, meilisearch)
VECTOR_ENGINE_TYPE=memory

# 用于向量搜索的 OceanBase 连接字符串（可选）
OCEANBASE_URL=mysql://username:password@localhost:3306/mcpadvisor
```

### 构建项目

```bash
pnpm run build
```

### 运行开发服务器

```bash
# 启动开发模式
pnpm run dev

# 或直接运行构建后的文件
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
│       ├── integration/# 集成测试
│       └── e2e/        # 端到端测试
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
- **可空类型**: 使用联合类型 `string | null` 而非可选参数 `string?`
- **枚举**: 对于有限集合的值，使用枚举类型
- **类型守卫**: 使用类型守卫进行类型收窄
- **泛型**: 适当使用泛型提高代码复用性和类型安全性
- **导入/导出**: 使用命名导出而非默认导出，保持一致性

**示例**:

```typescript
// 好的实践
export interface SearchOptions {
  minSimilarity?: number;
  limit: number;
}

export function search<T>(query: string, options: SearchOptions): Promise<T[]> {
  // 实现
}

// 避免的实践
export default function search(query: any, options?: any): any {
  // 实现
}
```

### 函数式编程原则

- **纯函数**: 尽量使用纯函数，避免副作用
- **不可变性**: 避免修改传入的参数，返回新对象
- **函数组合**: 使用小函数组合成复杂功能
- **单一职责**: 每个函数只做一件事
- **高阶函数**: 适当使用高阶函数如 `map`, `filter`, `reduce`
- **避免深度嵌套**: 使用函数组合或 Promise 链避免回调地狱

```typescript
// 好的实践
function normalizeVector(vector: number[]): number[] {
  const magnitude = calculateMagnitude(vector);
  return vector.map(value => value / magnitude);
}

// 避免的实践
function processVector(vector: number[]): number[] {
  // 做多件事: 计算、归一化、过滤等
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

- 对 MCP Inspector 和代理端口的自动清理改进，避免端口冲突问题。
- 采用模块化的测试辅助工具类进行环境管理。
- 使用新脚本结构与智能等待机制确保测试稳定性。

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
# 运行所有单元测试
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
```bash
# 运行 E2E 测试
pnpm run test:e2e

# Meilisearch E2E 测试
pnpm run test:meilisearch:e2e
```

### 测试示例

```typescript
describe('SearchService', () => {
  let service: SearchService;
  let mockProvider: MockProvider;
  let originalEnvVars: Record<string, string | undefined> = {};

  beforeEach(() => {
    // 保存原始环境变量
    originalEnvVars = {
      API_KEY: process.env.API_KEY,
      DATABASE_URL: process.env.DATABASE_URL
    };
    
    mockProvider = {
      search: vi.fn().mockResolvedValue([{ id: '1', name: 'Test' }])
    };
    service = new SearchService([mockProvider]);
  });

  afterEach(() => {
    // 恢复原始环境变量
    Object.entries(originalEnvVars).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  test('should return search results', async () => {
    // Given
    const query = 'test query';
    
    // When
    const results = await service.search(query);
    
    // Then
    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('name', 'Test');
    expect(mockProvider.search).toHaveBeenCalledWith(query);
  });
});
```

## 错误处理最佳实践

- **具体错误类型**: 使用具体错误类型而非通用 `Error`
- **有用的错误消息**: 提供带上下文的有用错误消息
- **错误传播**: 正确传播错误，不要忽略
- **异步错误**: 使用 `try/catch` 或 Promise `.catch()` 处理异步错误
- **错误日志**: 记录错误详情以便调试
- **优雅降级**: 尽可能提供优雅的降级方案
- **脚本退出码**: 脚本必须返回适当的退出码（成功 0，失败 1+）

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

```bash
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

项目配置了以下 pre-commit 检查：

1. **TypeScript 类型检查**: 确保代码无类型错误
2. **ESLint 检查**: 确保代码风格符合规范
3. **Commitlint 检查**: 验证提交消息格式

如果遇到提交被拦截的情况：

```bash
# 如果类型检查失败
pnpm run check
pnpm run build

# 如果 lint 检查失败
pnpm run lint:fix

# 如果提交消息格式错误，修正后重新提交
git commit --amend -m "feat: Add new feature description"
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
git commit -m "feat: add new feature"
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

1. **更新版本号**:
   ```bash
   # 自动更新版本号
   pnpm version patch  # 或 minor, major
   ```

2. **运行完整测试**:
   ```bash
   pnpm run check
   pnpm run test
   pnpm run test:e2e
   ```

3. **构建和验证**:
   ```bash
   pnpm run build
   npm pack --dry-run
   ```

4. **发布到 npm**:
   ```bash
   npm publish
   ```

5. **创建 Git 标签**:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

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
