# MCP Advisor 搜索接口升级技术方案（202506）

## 0. 更新状态
✅ **已完成** - 所有搜索提供者和相关测试已更新至新接口

## 1. 背景
当前核心离线搜索 `OfflineSearchProvider.search` 方法仅接受 `query: string` 作为入参，无法很好地表达复杂搜索意图。为提升精准度及后续功能拓展，需要将入参升级为结构化对象：

```ts
interface SearchParams {
  taskDescription: string;  // 任务描述（必填）
  keywords?: string[];      // 关键词列表（可选）
  capabilities?: string[];  // 期望能力（可选）
}
```

## 2. 影响范围
1. `src/services/search/OfflineSearchProvider.ts`
2. `src/services/search/OnlineSearchProvider.ts`（如存在）
3. 搜索聚合服务 `src/services/searchService.ts`
4. CLI / API 层调用者（如 `bin/cli.ts`, `ServerService` 等）
5. 单元测试 & 集成测试
6. 类型定义与文档

## 3. 设计要点
### 3.1 类型定义
- 在 `src/types/search.ts` 新增 `SearchParams`、`SearchResult` 等统一类型。
- 所有 Provider 统一接受 `SearchParams`，返回值保持 `MCPServerResponse[]` 不变。

### 3.2 Provider 层改造
1. **方法签名**
   ```ts
   // before
   async search(query: string): Promise<MCPServerResponse[]>;
   // after
   async search(params: SearchParams): Promise<MCPServerResponse[]>;
   ```
2. **逻辑更新**
   - `taskDescription` 作为主要相似度匹配文本。
   - `keywords` 用于额外向量或布尔过滤。
   - `capabilities` 参与向量搜索，提高推荐准确度。

### 3.3 调用链改造
- 所有直接调用 `search(string)` 的代码需改为 `search({ taskDescription, keywords, capabilities })`。
- 若调用方仅有一个字符串查询，迁移期可提供 shim：
  ```ts
  searchLegacy(query: string) {
    return this.search({ taskDescription: query });
  }
  ```
  并在之后版本删除。

### 3.4 CLI / API 兼容
- CLI: `mcpadvisor search "deploy huggingface"` → `mcpadvisor search -d "deploy huggingface" -k devops -c hnsw`。
- REST/SSE: 新增 JSON body 支持以上字段。

### 3.5 迁移策略
1. **阶段 1**（本 PR）
   - 引入 `SearchParams` 类型 & Provider 新签名。
   - 保留 `searchLegacy` shim，标记 `@deprecated`。
2. **阶段 2**
   - Refactor 所有内部调用至新接口。
   - 移除 shim，发布次版本号。

## 4. 实施步骤
| 步骤 | 负责人 | 说明 |
| ---- | ------ | ---- |
| 1 | A | 创建 `SearchParams` 类型文件 |
| 2 | A | 修改 Offline/Online Provider 签名及实现 |
| 3 | B | 更新聚合服务 & ServerService |
| 4 | C | 更新 CLI / API 参数解析 |
| 5 | D | 更新测试用例 |
| 6 | All | 代码 Review & 合并 |
| 7 | QA | 回归测试 |

## 5. 风险与应对
- **破坏性改动**：通过 shim 降低一次性爆炸风险。
- **调用遗漏**：启用 TypeScript `noImplicitAny`，编译期捕获。
- **性能回归**：新增字段需评估向量计算开销。

## 6. 时间线
- 技术方案评审：2025-06-16
- 开发 & 单元测试完成：2025-06-20 ✅
- 集成测试完成：2025-06-23 ✅
- 发布版本 `v2.2.0`：2025-06-24

## 7. 版本策略
- `v2.1.x`：兼容旧接口（含 shim）
- `v2.2.0`：移除旧接口，全面切换新参数

## 8. 已完成工作

### 8.1 代码修改
- 所有搜索提供者已更新至新接口：
  - `OfflineSearchProvider`
  - `GetMcpSearchProvider`
  - `MeilisearchSearchProvider`
  - `CompassSearchProvider`
- 更新了 `SearchService` 以处理新的 `SearchParams` 接口
- 修复了相关的类型定义和导入

### 8.2 测试更新
- 更新了所有测试用例以使用新的 `SearchParams` 接口
- 修复了测试中的模拟实现
- 验证了所有测试通过

### 8.3 文档更新
- 更新了内联文档和类型定义
- 添加了迁移指南

## 9. 潜在问题与解决方案

### 9.1 向后兼容性
- **问题**：旧客户端可能仍在使用字符串查询
- **解决方案**：
  - 在 `SearchService` 中添加了兼容层，自动将字符串查询转换为 `SearchParams`
  - 记录弃用警告，提示更新到新接口

### 9.2 性能考虑
- **问题**：额外的参数处理可能影响性能
- **解决方案**：
  - 对参数处理进行了优化，避免不必要的计算
  - 添加了性能测试，确保在可接受范围内

### 9.3 测试覆盖
- **问题**：新功能需要足够的测试覆盖
- **解决方案**：
  - 添加了针对新参数的单元测试
  - 更新了集成测试以覆盖边缘情况

## 10. 参考资料
- 《Clean Architecture》章节 *Use Case Interfaces*
- RFC-0005：搜索接口参数结构化提案
- PR-#457：向量搜索引擎抽象层


