# MCPAdvisor Meilisearch 本地/云端切换时序图

## 1. 系统启动与初始化时序

```mermaid
sequenceDiagram
    participant App as Application
    participant CM as ConfigManager
    participant CF as ClientFactory
    participant HM as HealthMonitor
    participant LC as LocalClient
    participant CC as CloudClient
    participant MS as MeilisearchService
    
    App->>CM: initialize()
    CM->>CM: loadEnvironmentConfig()
    CM->>CF: createFactory(config)
    
    alt Local Instance Selected
        CF->>LC: createLocalClient()
        LC->>MS: healthCheck()
        alt Local Healthy
            MS-->>LC: healthy: true
            LC-->>CF: client ready
            CF->>HM: registerClient(localClient)
        else Local Unhealthy
            MS-->>LC: healthy: false
            LC-->>CF: client failed
            CF->>CC: createCloudClient()
            CC->>CF: fallback client ready
            CF->>HM: registerClient(cloudClient)
        end
    else Cloud Instance Selected
        CF->>CC: createCloudClient()
        CC->>CF: client ready
        CF->>HM: registerClient(cloudClient)
    end
    
    HM->>HM: startHealthMonitoring()
    CF-->>App: factory ready
```

## 2. 搜索请求处理时序

```mermaid
sequenceDiagram
    participant Client as Client
    participant Router as SearchRouter
    participant Cache as CacheManager
    participant CB as CircuitBreaker
    participant LP as LocalProvider
    participant CP as CloudProvider
    participant MS as MeilisearchService
    
    Client->>Router: search(params)
    Router->>Cache: get(cacheKey)
    
    alt Cache Hit
        Cache-->>Router: cached results
        Router-->>Client: MCPServerResponse[]
    else Cache Miss
        Cache-->>Router: null
        Router->>CB: execute(searchOperation)
        
        alt Circuit Closed (Local Available)
            CB->>LP: search(params)
            LP->>MS: search(query, options)
            
            alt Search Success
                MS-->>LP: search results
                LP-->>CB: results
                CB-->>Router: results
                Router->>Cache: set(cacheKey, results)
                Router-->>Client: MCPServerResponse[]
            else Search Failed
                MS-->>LP: error
                LP-->>CB: error
                CB->>CB: recordFailure()
                CB-->>Router: error
                Router->>CP: search(params) // Fallback
                CP->>MS: search(query, options)
                MS-->>CP: search results
                CP-->>Router: results
                Router->>Cache: set(cacheKey, results)
                Router-->>Client: MCPServerResponse[]
            end
        else Circuit Open (Local Unavailable)
            CB-->>Router: circuit open error
            Router->>CP: search(params) // Direct fallback
            CP->>MS: search(query, options)
            MS-->>CP: search results
            CP-->>Router: results
            Router->>Cache: set(cacheKey, results)
            Router-->>Client: MCPServerResponse[]
        end
    end
```

## 3. 健康检查与故障转移时序

```mermaid
sequenceDiagram
    participant HM as HealthMonitor
    participant LC as LocalClient
    participant CC as CloudClient
    participant CB as CircuitBreaker
    participant NM as NotificationManager
    participant Admin as Administrator
    
    loop Health Check Cycle
        HM->>LC: healthCheck()
        
        alt Local Healthy
            LC-->>HM: healthy: true
            HM->>CB: recordSuccess()
            CB->>CB: resetFailureCount()
        else Local Unhealthy
            LC-->>HM: healthy: false
            HM->>CB: recordFailure()
            CB->>CB: incrementFailureCount()
            
            alt Failure Threshold Exceeded
                CB->>CB: openCircuit()
                CB->>NM: notifyCircuitOpen()
                NM->>Admin: alert: local instance down
                
                HM->>CC: healthCheck()
                CC-->>HM: healthy: true
                HM->>NM: notifyFallbackActive()
                NM->>Admin: info: using cloud fallback
            end
        end
        
        HM->>HM: wait(healthCheckInterval)
    end
```

## 4. 数据同步时序

```mermaid
sequenceDiagram
    participant DS as DataSyncService
    participant DL as DataLoader
    participant LC as LocalClient
    participant CC as CloudClient
    participant FS as FileSystem
    participant API as GetMcpAPI
    
    DS->>DS: startSyncProcess()
    DS->>DL: loadLatestData()
    
    alt Local Instance Active
        DL->>FS: readLocalData()
        FS-->>DL: local data
        DL->>API: fetchRemoteData()
        API-->>DL: remote data
        DL->>DL: compareData()
        
        alt Data Changed
            DL->>LC: updateDocuments(newData)
            LC->>LC: reindexDocuments()
            LC-->>DL: update complete
            DL->>DS: syncStatus: success
        else No Changes
            DL->>DS: syncStatus: no changes
        end
    else Cloud Instance Active
        DL->>API: fetchRemoteData()
        API-->>DL: remote data
        DL->>CC: verifyDataSync()
        CC-->>DL: sync verified
        DL->>DS: syncStatus: cloud sync verified
    end
    
    DS->>DS: schedulNextSync()
```

## 5. 配置热更新时序

```mermaid
sequenceDiagram
    participant Admin as Administrator
    participant API as ConfigAPI
    participant CM as ConfigManager
    participant CF as ClientFactory
    participant HM as HealthMonitor
    participant App as Application
    
    Admin->>API: updateConfig(newConfig)
    API->>CM: validateConfig(newConfig)
    CM->>CM: validate()
    
    alt Config Valid
        CM-->>API: validation: success
        API->>CM: applyConfig(newConfig)
        CM->>CF: recreateFactory(newConfig)
        
        alt Switch to Local
            CF->>CF: createLocalClient()
            CF->>HM: updateMonitoring(localClient)
            HM->>HM: startLocalMonitoring()
        else Switch to Cloud
            CF->>CF: createCloudClient()
            CF->>HM: updateMonitoring(cloudClient)
            HM->>HM: startCloudMonitoring()
        end
        
        CF-->>CM: factory updated
        CM->>App: notifyConfigChange()
        App->>App: refreshServices()
        CM-->>API: config applied
        API-->>Admin: success: config updated
    else Config Invalid
        CM-->>API: validation: failed
        API-->>Admin: error: invalid config
    end
```

## 6. 错误处理与恢复时序

```mermaid
sequenceDiagram
    participant Client as Client
    participant Router as SearchRouter
    participant EM as ErrorManager
    parameter LC as LocalClient
    participant CC as CloudClient
    participant HM as HealthMonitor
    
    Client->>Router: search(params)
    Router->>LC: search(params)
    LC->>LC: performSearch()
    
    alt Connection Error
        LC-->>Router: ConnectionError
        Router->>EM: handleError(ConnectionError)
        EM->>HM: reportConnectionFailure()
        HM->>HM: updateHealthStatus(unhealthy)
        EM->>CC: initiateFailover()
        CC->>Router: search(params)
        Router-->>Client: results from cloud
    else Timeout Error
        LC-->>Router: TimeoutError
        Router->>EM: handleError(TimeoutError)
        EM->>LC: retryWithBackoff()
        LC->>LC: performSearch()
        
        alt Retry Success
            LC-->>Router: search results
            Router-->>Client: results
        else Retry Failed
            LC-->>Router: TimeoutError
            Router->>CC: search(params)
            CC-->>Router: search results
            Router-->>Client: results from cloud
        end
    else Index Error
        LC-->>Router: IndexError
        Router->>EM: handleError(IndexError)
        EM->>LC: reinitializeIndex()
        LC->>LC: recreateIndex()
        LC-->>EM: index recreated
        EM->>Router: retrySearch()
        Router->>LC: search(params)
        LC-->>Router: search results
        Router-->>Client: results
    end
```

## 7. 性能监控时序

```mermaid
sequenceDiagram
    participant PM as PerformanceMonitor
    participant MC as MetricsCollector
    participant LC as LocalClient
    participant CC as CloudClient
    participant Alert as AlertManager
    participant Admin as Administrator
    
    loop Monitoring Cycle
        PM->>MC: collectMetrics()
        MC->>LC: getPerformanceMetrics()
        LC-->>MC: localMetrics
        MC->>CC: getPerformanceMetrics()
        CC-->>MC: cloudMetrics
        MC->>MC: aggregateMetrics()
        MC-->>PM: metrics
        
        PM->>PM: analyzePerformance()
        
        alt Performance Degraded
            PM->>Alert: triggerAlert(performance)
            Alert->>Admin: alert: performance degraded
            PM->>PM: suggestOptimizations()
        else Performance Normal
            PM->>PM: updateBaseline()
        end
        
        PM->>PM: wait(monitoringInterval)
    end
```

## 8. 二进制部署与升级时序

```mermaid
sequenceDiagram
    participant Deploy as DeploymentService
    participant Binary as BinaryManager
    participant HC as HealthChecker
    participant Service as SystemService
    participant App as Application
    
    Deploy->>Binary: downloadBinary(version)
    Binary-->>Deploy: binary downloaded
    Deploy->>Binary: verifyChecksum()
    Binary-->>Deploy: checksum verified
    Deploy->>Service: stopService()
    Service-->>Deploy: service stopped
    Deploy->>Binary: installBinary()
    Binary-->>Deploy: binary installed
    Deploy->>Service: startService()
    Service-->>Deploy: service started
    
    Deploy->>HC: waitForHealthy()
    
    loop Health Check
        HC->>Service: healthCheck()
        Service-->>HC: health status
        
        alt Healthy
            HC-->>Deploy: service ready
            Deploy->>App: routeTraffic(newInstance)
            Deploy->>Binary: cleanupOldBinary()
            Binary-->>Deploy: cleanup complete
        else Unhealthy
            HC->>HC: wait(checkInterval)
        end
    end
```

## 9. 状态图 - 实例状态管理

```mermaid
stateDiagram-v2
    [*] --> Initializing
    Initializing --> Healthy: Health check passed
    Initializing --> Failed: Health check failed
    Healthy --> Degraded: Performance issues
    Healthy --> Failed: Connection lost
    Degraded --> Healthy: Performance recovered
    Degraded --> Failed: Health check failed
    Failed --> Recovering: Retry attempt
    Recovering --> Healthy: Recovery successful
    Recovering --> Failed: Recovery failed
    Failed --> [*]: Shutdown requested
    
    state Healthy {
        [*] --> Active
        Active --> Standby: Load balancing
        Standby --> Active: Failover triggered
    }
    
    state Failed {
        [*] --> CircuitOpen
        CircuitOpen --> HalfOpen: Reset timeout
        HalfOpen --> CircuitOpen: Test failed
        HalfOpen --> [*]: Test passed
    }
```

## 10. 时序图总结

这些时序图展示了 MCPAdvisor Meilisearch 集成的完整生命周期，包括：

1. **系统启动**: 配置加载、客户端创建、健康检查
2. **搜索处理**: 缓存策略、熔断机制、故障转移
3. **健康监控**: 定期检查、故障检测、自动切换
4. **数据同步**: 本地/云端数据一致性保证
5. **配置管理**: 热更新、验证、应用
6. **错误处理**: 多层次错误恢复机制
7. **性能监控**: 指标收集、性能分析、告警
8. **二进制部署**: 版本升级、健康检查、服务切换

这些时序图为开发和运维团队提供了清晰的系统行为指南，有助于理解系统的复杂交互过程和故障处理机制。