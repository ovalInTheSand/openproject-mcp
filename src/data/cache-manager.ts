// src/data/cache-manager.ts
import type { 
  CacheEntry, 
  CacheStrategy, 
  EVMCalculation, 
  CriticalPathAnalysis, 
  ResourceUtilization,
  PMOVariables 
} from "../types/hybrid-data";

/**
 * SQLite-based Cache Manager for PMO Calculations
 * 
 * Provides intelligent caching for expensive calculations while ensuring
 * fresh data for rapidly changing metrics. Uses TTL-based expiration
 * and smart cache invalidation strategies.
 */
export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly strategy: CacheStrategy = {
    neverCache: [
      'workPackageProgress',
      'timeEntries',
      'projectStatus',
      'currentAssignments'
    ],
    cacheForSession: [
      'projectVariables',
      'userRates',
      'organizationalPolicies',
      'projectConfiguration'
    ],
    cacheWithExpiry: [
      { key: 'evmCalculations', ttlSeconds: 3600 },        // 1 hour
      { key: 'criticalPathAnalysis', ttlSeconds: 1800 },   // 30 minutes
      { key: 'portfolioAnalytics', ttlSeconds: 7200 },     // 2 hours
      { key: 'resourceUtilization', ttlSeconds: 1800 },    // 30 minutes
      { key: 'riskAnalysis', ttlSeconds: 3600 },           // 1 hour
      { key: 'performanceMetrics', ttlSeconds: 900 },      // 15 minutes
      { key: 'budgetForecasts', ttlSeconds: 3600 }         // 1 hour
    ]
  };
  
  constructor() {
    // Note: In Cloudflare Workers, setInterval is not allowed in global scope
    // Cleanup will be handled on-demand during cache operations
  }
  
  /**
   * Get cached data if valid, otherwise return null
   */
  async get<T>(key: string, projectId?: string | number): Promise<T | null> {
    // Periodically cleanup expired entries during normal operations
    this.maybeCleanupExpiredEntries();
    
    const cacheKey = this.buildCacheKey(key, projectId);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return entry.data as T;
  }
  
  /**
   * Store data in cache with appropriate TTL based on strategy
   */
  async set<T>(
    key: string, 
    data: T, 
    projectId?: string | number,
    customTTL?: number
  ): Promise<void> {
    // Check if this type of data should be cached
    if (this.strategy.neverCache.includes(key)) {
      return; // Don't cache
    }
    
    const ttl = customTTL || this.getTTLForKey(key);
    const cacheKey = this.buildCacheKey(key, projectId);
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      projectId: projectId ? String(projectId) : 'global',
      calculationType: key
    };
    
    this.cache.set(cacheKey, entry);
  }
  
  /**
   * Invalidate cache entries for a specific project or calculation type
   */
  async invalidate(pattern: string, projectId?: string | number): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const [cacheKey, entry] of this.cache.entries()) {
      const matchesPattern = cacheKey.includes(pattern);
      const matchesProject = !projectId || entry.projectId === String(projectId);
      
      if (matchesPattern && matchesProject) {
        keysToDelete.push(cacheKey);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }
  
  /**
   * Cache EVM calculation results
   */
  async cacheEVMCalculation(
    projectId: string | number, 
    calculation: EVMCalculation
  ): Promise<void> {
    await this.set('evmCalculations', calculation, projectId);
  }
  
  /**
   * Get cached EVM calculation
   */
  async getEVMCalculation(projectId: string | number): Promise<EVMCalculation | null> {
    return await this.get<EVMCalculation>('evmCalculations', projectId);
  }
  
  /**
   * Cache critical path analysis results
   */
  async cacheCriticalPathAnalysis(
    projectId: string | number, 
    analysis: CriticalPathAnalysis
  ): Promise<void> {
    await this.set('criticalPathAnalysis', analysis, projectId);
  }
  
  /**
   * Get cached critical path analysis
   */
  async getCriticalPathAnalysis(projectId: string | number): Promise<CriticalPathAnalysis | null> {
    return await this.get<CriticalPathAnalysis>('criticalPathAnalysis', projectId);
  }
  
  /**
   * Cache resource utilization data
   */
  async cacheResourceUtilization(
    key: string,
    utilization: ResourceUtilization[]
  ): Promise<void> {
    await this.set('resourceUtilization', utilization, key);
  }
  
  /**
   * Get cached resource utilization
   */
  async getResourceUtilization(key: string): Promise<ResourceUtilization[] | null> {
    return await this.get<ResourceUtilization[]>('resourceUtilization', key);
  }
  
  /**
   * Cache PMO variables (session-based caching)
   */
  async cachePMOVariables(
    projectId: string | number, 
    variables: PMOVariables
  ): Promise<void> {
    // PMO variables cached for session (no TTL expiry)
    await this.set('projectVariables', variables, projectId, 0);
  }
  
  /**
   * Get cached PMO variables
   */
  async getPMOVariables(projectId: string | number): Promise<PMOVariables | null> {
    return await this.get<PMOVariables>('projectVariables', projectId);
  }
  
  /**
   * Cache calculation metadata for debugging and optimization
   */
  async cacheCalculationMetadata(
    calculationType: string,
    projectId: string | number,
    metadata: {
      executionTime: number;
      inputDataSize: number;
      complexity: 'low' | 'medium' | 'high';
      dependencies: string[];
    }
  ): Promise<void> {
    const key = `metadata_${calculationType}`;
    await this.set(key, metadata, projectId, 3600); // 1 hour TTL
  }
  
  /**
   * Get cache statistics for monitoring and optimization
   */
  getCacheStatistics(): {
    totalEntries: number;
    expiredEntries: number;
    memoryUsage: string;
    hitRate: number;
    topCalculationTypes: { type: string; count: number }[];
  } {
  // timestamp not currently used; retained logic simplified
    let expiredCount = 0;
    const typeCount = new Map<string, number>();
    
    for (const entry of this.cache.values()) {
      if (this.isExpired(entry)) {
        expiredCount++;
      }
      
      const count = typeCount.get(entry.calculationType) || 0;
      typeCount.set(entry.calculationType, count + 1);
    }
    
    const topTypes = Array.from(typeCount.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));
    
    // Rough memory usage estimation
    const estimatedSize = this.cache.size * 1024; // Rough estimate in bytes
    const memoryUsage = estimatedSize > 1024 * 1024 
      ? `${Math.round(estimatedSize / (1024 * 1024))}MB`
      : `${Math.round(estimatedSize / 1024)}KB`;
    
    return {
      totalEntries: this.cache.size,
      expiredEntries: expiredCount,
      memoryUsage,
      hitRate: this.calculateHitRate(),
      topCalculationTypes: topTypes
    };
  }
  
  /**
   * Smart cache warming for frequently accessed calculations
   */
  async warmCache(projectIds: (string | number)[]): Promise<void> {
    const warmingTasks = projectIds.map(async (projectId) => {
      // Pre-warm commonly accessed data
      const cacheKeys = [
        'projectVariables',
        'projectConfiguration',
        'userRates'
      ];
      
      // These would typically be loaded from the data source
      // For now, we'll just ensure the cache structure is ready
      cacheKeys.forEach(key => {
        const cacheKey = this.buildCacheKey(key, projectId);
        if (!this.cache.has(cacheKey)) {
          // Mark as warming to prevent duplicate requests
          this.cache.set(cacheKey, {
            data: null,
            timestamp: Date.now(),
            ttl: 60, // Short TTL for warming markers
            projectId: String(projectId),
            calculationType: `${key}_warming`
          });
        }
      });
    });
    
    await Promise.all(warmingTasks);
  }
  
  /**
   * Clear all cached data (useful for testing or reset scenarios)
   */
  async clearAll(): Promise<void> {
    this.cache.clear();
  }
  
  /**
   * Clear cache for specific project
   */
  async clearProject(projectId: string | number): Promise<void> {
    const keysToDelete: string[] = [];
    
    for (const [cacheKey, entry] of this.cache.entries()) {
      if (entry.projectId === String(projectId)) {
        keysToDelete.push(cacheKey);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }
  
  // Private helper methods
  
  private buildCacheKey(key: string, projectId?: string | number): string {
    return projectId ? `${key}:${projectId}` : `${key}:global`;
  }
  
  private getTTLForKey(key: string): number {
    // Session-based caching (no expiry)
    if (this.strategy.cacheForSession.includes(key)) {
      return 0; // 0 means no expiry
    }
    
    // TTL-based caching
    const expiryRule = this.strategy.cacheWithExpiry.find(rule => 
      key.includes(rule.key) || rule.key === key
    );
    
    if (expiryRule) {
      return expiryRule.ttlSeconds;
    }
    
    // Default TTL for unknown keys
    return 1800; // 30 minutes
  }
  
  private isExpired(entry: CacheEntry<any>): boolean {
    // No expiry (session-based)
    if (entry.ttl === 0) {
      return false;
    }
    
    const now = Date.now();
    const expiryTime = entry.timestamp + (entry.ttl * 1000);
    
    return now > expiryTime;
  }
  
  private lastCleanup: number = 0;
  
  private cleanupExpiredEntries(): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`Cache cleanup: Removed ${keysToDelete.length} expired entries`);
    }
    
    this.lastCleanup = Date.now();
  }
  
  private maybeCleanupExpiredEntries(): void {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    // Only run cleanup if it's been more than 5 minutes since last cleanup
    if (now - this.lastCleanup > fiveMinutes) {
      this.cleanupExpiredEntries();
    }
  }
  
  private hitRate: number = 0;
  private totalRequests: number = 0;
  private cacheHits: number = 0;
  
  private calculateHitRate(): number {
    if (this.totalRequests === 0) return 0;
    return Math.round((this.cacheHits / this.totalRequests) * 100) / 100;
  }
  
  /**
   * Track cache performance metrics
   */
  private trackCacheAccess(isHit: boolean): void {
    this.totalRequests++;
    if (isHit) {
      this.cacheHits++;
    }
    
    // Update hit rate
    this.hitRate = this.calculateHitRate();
  }
  
  /**
   * Enhanced get method with performance tracking
   */
  async getWithTracking<T>(key: string, projectId?: string | number): Promise<T | null> {
    const result = await this.get<T>(key, projectId);
    this.trackCacheAccess(result !== null);
    return result;
  }
  
  /**
   * Bulk cache operations for efficiency
   */
  async setBulk<T>(entries: Array<{
    key: string;
    data: T;
    projectId?: string | number;
    ttl?: number;
  }>): Promise<void> {
    const tasks = entries.map(entry => 
      this.set(entry.key, entry.data, entry.projectId, entry.ttl)
    );
    
    await Promise.all(tasks);
  }
  
  /**
   * Cache health check for monitoring
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    recommendations: string[];
  } {
    const stats = this.getCacheStatistics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    // Check for high expired entry ratio
    const expiredRatio = stats.totalEntries > 0 ? stats.expiredEntries / stats.totalEntries : 0;
    if (expiredRatio > 0.3) {
      issues.push('High ratio of expired entries');
      recommendations.push('Consider adjusting TTL values for better performance');
      status = 'warning';
    }
    
    // Check hit rate
    if (stats.hitRate < 0.5) {
      issues.push('Low cache hit rate');
      recommendations.push('Review caching strategy and TTL values');
      if (status === 'healthy') status = 'warning';
    }
    
    // Check memory usage (rough estimate)
    if (stats.totalEntries > 1000) {
      issues.push('High number of cached entries');
      recommendations.push('Consider implementing LRU eviction or reducing cache size');
      if (status === 'healthy') status = 'warning';
    }
    
    return { status, issues, recommendations };
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();