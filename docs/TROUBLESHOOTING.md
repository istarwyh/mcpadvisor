# 故障排除

[English](./TROUBLESHOOTING.en.md) | [简体中文](./TROUBLESHOOTING.md)

本文档提供了 MCP Advisor 常见问题的解决方案和诊断技巧。

## 目录

- [连接问题](#连接问题)
- [搜索问题](#搜索问题)
- [性能问题](#性能问题)
- [配置问题](#配置问题)
- [日志和调试](#日志和调试)
- [常见错误代码](#常见错误代码)

## 连接问题

### 连接被拒绝

**症状**: 尝试连接到 MCP Advisor 服务器时收到 "Connection refused" 错误。

**可能的原因**:
1. 服务器未运行
2. 端口配置不正确
3. 防火墙阻止连接
4. 主机地址不正确

**解决方案**:
1. 确保服务器正在运行：
   ```bash
   ps aux | grep mcpadvisor
   ```

2. 验证端口配置：
   ```bash
   # 检查端口是否被使用
   lsof -i :3000
   
   # 确认环境变量设置
   echo $SERVER_PORT
   ```

3. 检查防火墙设置：
   ```bash
   # MacOS
   sudo pfctl -s rules
   
   # Linux
   sudo iptables -L
   ```

4. 验证主机地址：
   ```bash
   # 确认环境变量设置
   echo $SERVER_HOST
   ```

### SSE 连接断开

**症状**: 服务器发送事件 (SSE) 连接频繁断开。

**可能的原因**:
1. 客户端超时设置太短
2. 服务器资源限制
3. 网络不稳定
4. CORS 配置问题

**解决方案**:
1. 增加客户端超时设置：
   ```javascript
   const eventSource = new EventSource('/sse', {
     withCredentials: true
   });
   ```

2. 检查服务器日志中的错误消息：
   ```bash
   tail -f logs/error.log
   ```

3. 确保正确的 CORS 配置（从浏览器连接时）：
   ```javascript
   // 服务器端 CORS 配置
   app.use(cors({
     origin: true,
     credentials: true
   }));
   ```

4. 考虑使用 WebSocket 而不是 SSE 以获得更好的连接稳定性。

## 搜索问题

### 未返回结果

**症状**: 搜索查询未返回任何结果，即使应该有匹配项。

**可能的原因**:
1. 查询太具体
2. 网络连接问题
3. API 端点配置不正确
4. 相似度阈值太高

**解决方案**:
1. 尝试更一般的查询：
   ```
   # 太具体
   "用于金融数据分析的 MCP 服务器，支持实时数据流和高级可视化"
   
   # 更一般
   "金融数据分析 MCP"
   ```

2. 检查与注册表 API 的网络连接：
   ```bash
   curl -v https://getmcp.io/api/servers
   ```

3. 验证 API 端点配置：
   ```bash
   # 检查环境变量
   env | grep API
   ```

4. 降低相似度阈值：
   ```javascript
   // 默认值为 0.5，尝试降低
   const results = await searchService.search(query, { minSimilarity: 0.3 });
   ```

### 结果不相关

**症状**: 搜索返回的结果与查询不相关。

**可能的原因**:
1. 向量嵌入质量问题
2. 文本匹配权重不平衡
3. 提供者优先级不正确
4. 语言不匹配

**解决方案**:
1. 检查向量嵌入模型：
   ```bash
   # 确认使用的嵌入模型
   grep -r "embeddingModel" src/
   ```

2. 调整文本和向量搜索权重：
   ```javascript
   // 增加文本匹配权重
   const results = await searchService.search(query, {
     textMatchWeight: 0.5,
     vectorMatchWeight: 0.5
   });
   ```

3. 调整提供者优先级：
   ```javascript
   // 在配置文件中
   const PROVIDER_PRIORITIES = {
     'compass': 3,
     'getmcp': 2,
     'meilisearch': 2,
     'offline': 1
   };
   ```

4. 确保使用多语言支持的嵌入模型。

## 性能问题

### 搜索响应缓慢

**症状**: 搜索查询需要很长时间才能返回结果。

**可能的原因**:
1. 服务器资源限制
2. 外部 API 延迟
3. 向量计算开销大
4. 缺少缓存

**解决方案**:
1. 检查服务器资源使用情况：
   ```bash
   top -u <username>
   ```

2. 监控外部 API 调用时间：
   ```bash
   # 启用性能日志
   LOG_LEVEL=debug ENABLE_PERFORMANCE_LOGGING=true npm start
   ```

3. 实现查询缓存：
   ```javascript
   // 使用内存缓存
   const queryCache = new Map();
   
   async function cachedSearch(query, options) {
     const cacheKey = `${query}-${JSON.stringify(options)}`;
     
     if (queryCache.has(cacheKey)) {
       return queryCache.get(cacheKey);
     }
     
     const results = await actualSearch(query, options);
     queryCache.set(cacheKey, results);
     
     return results;
   }
   ```

4. 优化向量计算：
   ```javascript
   // 使用批处理
   const embeddings = await batchGenerateEmbeddings(queries);
   ```

### 内存使用过高

**症状**: 服务器内存使用量持续增加，可能导致崩溃。

**可能的原因**:
1. 内存泄漏
2. 缓存无限增长
3. 大型向量数据集
4. 日志记录过多

**解决方案**:
1. 使用内存分析工具：
   ```bash
   # 使用 Node.js 内置的堆快照
   node --inspect server.js
   ```

2. 实现 LRU 缓存限制大小：
   ```javascript
   const LRU = require('lru-cache');
   
   const cache = new LRU({
     max: 500, // 最大项数
     maxAge: 1000 * 60 * 60 // 1小时过期
   });
   ```

3. 减少向量维度或使用维度减少技术：
   ```javascript
   // 使用 PCA 减少维度
   const reducedVector = applyPCA(originalVector, 100);
   ```

4. 限制日志详细程度：
   ```bash
   LOG_LEVEL=info npm start
   ```

## 配置问题

### 环境变量不生效

**症状**: 更改环境变量但没有影响。

**可能的原因**:
1. 环境变量格式不正确
2. 应用程序未重启
3. 配置加载顺序问题
4. 变量名拼写错误

**解决方案**:
1. 检查环境变量格式：
   ```bash
   # 正确格式
   export TRANSPORT_TYPE=sse
   
   # 或在 .env 文件中
   TRANSPORT_TYPE=sse
   ```

2. 重启应用程序：
   ```bash
   npm restart
   ```

3. 验证配置加载顺序：
   ```javascript
   // 检查配置加载代码
   console.log('Loading configuration...');
   console.log(process.env);
   ```

4. 仔细检查变量名：
   ```bash
   # 列出所有环境变量
   env | grep MCP
   ```

### 配置文件冲突

**症状**: 配置文件和环境变量设置冲突。

**可能的原因**:
1. 多个配置源
2. 优先级不明确
3. 配置文件格式错误

**解决方案**:
1. 了解配置优先级：
   - 命令行参数 > 环境变量 > 配置文件 > 默认值

2. 检查配置文件格式：
   ```bash
   # 验证 JSON 格式
   jq . config.json
   ```

3. 明确设置单一配置源：
   ```bash
   # 清除环境变量
   unset TRANSPORT_TYPE
   
   # 使用配置文件
   CONFIG_FILE=./custom-config.json npm start
   ```

## 开发和提交问题

### Pre-commit 钩子失败

**症状**: Git 提交被 pre-commit 钩子拦截。

**可能原因**:
1. TypeScript 类型错误
2. ESLint 代码风格问题
3. 提交消息格式不符合规范

**解决方案**:

1. **TypeScript 类型检查失败**:
   ```bash
   # 运行类型检查
   pnpm run check
   
   # 修复类型错误后重新构建
   pnpm run build
   
   # 重新提交
   git commit -m "fix: Fix type errors"
   ```

2. **ESLint 检查失败**:
   ```bash
   # 自动修复 lint 问题
   pnpm run lint:fix
   
   # 手动检查剩余问题
   pnpm run lint
   
   # 重新提交
   git add .
   git commit -m "style: Fix linting issues"
   ```

3. **提交消息格式错误**:
   ```bash
   # 错误示例 (小写开头)
   git commit -m "feat: add new feature"
   # ❌ 错误: subject must be sentence-case [subject-case]
   
   # 正确格式 (大写开头)
   git commit -m "feat: Add new feature"
   # ✅ 正确
   
   # 如果已经提交但被拦截，修改最后一次提交消息
   git commit --amend -m "feat: Add new feature with proper case"
   ```

4. **完全跳过预提交钩子** (不推荐):
   ```bash
   # 仅在紧急情况下使用
   git commit --no-verify -m "feat: Emergency commit"
   ```

### 常见提交消息错误

**错误类型及修复**:

1. **句子格式错误**:
   ```bash
   # ❌ 错误
   feat: add vector search functionality
   
   # ✅ 正确
   feat: Add vector search functionality
   ```

2. **类型错误**:
   ```bash
   # ❌ 错误
   feature: Add new search provider
   
   # ✅ 正确
   feat: Add new search provider
   ```

3. **过长的主题行**:
   ```bash
   # ❌ 错误 (超过 72 个字符)
   feat: Add comprehensive vector similarity search functionality with Meilisearch integration and fallback mechanisms
   
   # ✅ 正确
   feat: Add vector similarity search with Meilisearch
   
   Add comprehensive search functionality with proper fallback
   mechanisms and error handling.
   ```

### 开发环境问题

**Node.js 版本不兼容**:
```bash
# 检查当前 Node.js 版本
node --version

# 使用 nvm 切换到推荐版本
nvm use 18

# 或安装推荐版本
nvm install 18
nvm alias default 18
```

**依赖安装问题**:
```bash
# 清理依赖缓存
pnpm store prune

# 删除 node_modules 和 lockfile
rm -rf node_modules pnpm-lock.yaml

# 重新安装
pnpm install
```

## 日志和调试

### 启用详细日志

要启用详细日志记录以进行故障排除：

```bash
# 启用调试日志
DEBUG=true LOG_LEVEL=debug npm start

# 启用文件日志
ENABLE_FILE_LOGGING=true npm start

# 启用性能日志
ENABLE_PERFORMANCE_LOGGING=true npm start
```

### 查看日志文件

日志文件位于 `logs` 目录：

```bash
# 查看最新日志
tail -f logs/mcpadvisor.log

# 查看错误日志
grep ERROR logs/mcpadvisor.log

# 查看特定组件的日志
grep "SearchService" logs/mcpadvisor.log
```

### 使用调试工具

使用 Node.js 调试工具：

```bash
# 启用检查器
node --inspect build/index.js

# 在 Chrome 中打开
chrome://inspect
```

## 常见错误代码

### ERR_CONNECTION_REFUSED

**描述**: 无法建立到服务器的连接。

**解决方案**:
1. 确保服务器正在运行
2. 检查主机和端口配置
3. 验证网络连接

### ERR_INVALID_QUERY

**描述**: 查询格式无效或为空。

**解决方案**:
1. 确保查询不为空
2. 检查查询格式
3. 移除特殊字符

### ERR_PROVIDER_UNAVAILABLE

**描述**: 一个或多个搜索提供者不可用。

**解决方案**:
1. 检查外部 API 状态
2. 验证 API 密钥和凭据
3. 确认网络连接

### ERR_VECTOR_GENERATION

**描述**: 无法生成文本的向量嵌入。

**解决方案**:
1. 检查嵌入模型配置
2. 验证文本输入
3. 确保有足够的内存

### ERR_RATE_LIMIT

**描述**: 已达到外部 API 的速率限制。

**解决方案**:
1. 减少请求频率
2. 实现请求节流
3. 考虑升级 API 计划

## 高级故障排除

### 诊断网络问题

使用网络诊断工具：

```bash
# 检查网络连接
ping getmcp.io

# 跟踪网络路由
traceroute getmcp.io

# 检查 DNS 解析
dig getmcp.io

# 测试 HTTP 连接
curl -v https://getmcp.io/api/health
```

### 性能分析

使用性能分析工具：

```bash
# 使用 Node.js 内置分析器
node --prof build/index.js

# 分析结果
node --prof-process isolate-*.log > profile.txt

# 使用 clinic.js
npx clinic doctor -- node build/index.js
```

### 内存泄漏调查

识别和修复内存泄漏：

```bash
# 生成堆快照
node --inspect build/index.js
# 在 Chrome DevTools 中分析堆快照

# 使用 memwatch
npm install memwatch-next
# 在代码中添加
const memwatch = require('memwatch-next');
memwatch.on('leak', (info) => {
  console.log('Memory leak detected:', info);
});
```

## 获取帮助

如果您无法解决问题，请尝试以下资源：

1. 查看 [GitHub Issues](https://github.com/istarwyh/mcpadvisor/issues)
2. 在 [GitHub Discussions](https://github.com/istarwyh/mcpadvisor/discussions) 中提问
3. 提交带有详细信息的新 Issue：
   - 操作系统和版本
   - Node.js 版本
   - MCP Advisor 版本
   - 完整错误消息
   - 重现步骤
   - 日志片段

---

相关文档：
- [快速开始指南](./GETTING_STARTED.md) - 安装配置和基本使用
- [技术参考手册](./TECHNICAL_REFERENCE.md) - 高级技术特性和配置
- [架构文档](./ARCHITECTURE.md) - 系统架构和组件详解
- [贡献指南](../CONTRIBUTING.md) - 开发环境设置和代码贡献
