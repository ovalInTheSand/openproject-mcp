// src/data/hybrid-manager.ts
// Use TypeScript source import without .js so ts-node/loader resolves correctly during tests
import { nativeExtractor } from "./native-extractor";
import { customCalculator } from "./custom-calculator";
import { cacheManager } from "./cache-manager";
import { variableManager } from "./variable-manager";
import type { 
  HybridProjectData, 
  NativeProjectMetrics,
  PMOVariables,
  EVMCalculation,
  CriticalPathAnalysis,
  ResourceUtilization
} from "../types/hybrid-data";
import type { Ctx } from "../tools";

/**
 * Hybrid Data Manager - Central orchestrator for PMO data
 * 
 * Coordinates between:
 * 1. Native OpenProject data extraction
 * 2. Custom enterprise calculations
 * 3. PMO variable management
 * 4. Intelligent caching
 * 
 * Provides a unified interface for all PMO data needs while
 * maximizing performance and accuracy.
 */
export class HybridDataManager {
  
  /**
   * Get complete project data using hybrid approach
   */
  async getProjectData(ctx: Ctx, projectId: string | number): Promise<HybridProjectData> {
    const startTime = Date.now();
    
    // Always get fresh native data from OpenProject
    const nativeData = await nativeExtractor.getProjectMetrics(ctx, projectId);
    
    // Get PMO variables (cached for session)
    let variables = await cacheManager.getPMOVariables(projectId);
    if (!variables) {
      variables = await variableManager.getProjectVariables(ctx, projectId);
      await cacheManager.cachePMOVariables(projectId, variables);
    }
    
    // Get cached calculations or compute if needed
    const calculations = await this.getCalculations(ctx, projectId, nativeData, variables);
    
    const executionTime = Date.now() - startTime;
    
    // Cache calculation metadata for performance monitoring
    await cacheManager.cacheCalculationMetadata('hybridProjectData', projectId, {
      executionTime,
      inputDataSize: nativeData.workPackages.length + nativeData.timeEntries.length,
      complexity: this.assessComplexity(nativeData),
      dependencies: ['nativeData', 'variables', 'calculations']
    });
    
    return {
      native: nativeData,
      variables,
      calculations
    };
  }
  
  /**
   * Get or compute enterprise calculations with intelligent caching
   */
  private async getCalculations(
    ctx: Ctx,
    projectId: string | number,
    nativeData: NativeProjectMetrics,
    variables: PMOVariables
  ) {
    const now = new Date().toISOString();
    
    // Try to get cached calculations
    const cachedEVM = await cacheManager.getEVMCalculation(projectId);
    const cachedCriticalPath = await cacheManager.getCriticalPathAnalysis(projectId);
    const cachedResources = await cacheManager.getResourceUtilization(`project_${projectId}`);
    
    // Determine what needs to be recalculated
    const needsEVMRecalc = !cachedEVM || this.shouldRecalculateEVM(cachedEVM, nativeData);
    const needsCriticalPathRecalc = !cachedCriticalPath || this.shouldRecalculateCriticalPath(cachedCriticalPath, nativeData);
    const needsResourceRecalc = !cachedResources || this.shouldRecalculateResources(cachedResources, nativeData);
    
    // Perform calculations in parallel for efficiency
    const [evm, criticalPath, resourceUtilization] = await Promise.all([
      needsEVMRecalc ? this.calculateAndCacheEVM(projectId, nativeData, variables) : cachedEVM,
      needsCriticalPathRecalc ? this.calculateAndCacheCriticalPath(ctx, projectId, nativeData) : cachedCriticalPath,
      needsResourceRecalc ? this.calculateAndCacheResourceUtilization(ctx, projectId, nativeData, variables) : cachedResources
    ]);
    
    return {
      evm,
      criticalPath,
      resourceUtilization,
      lastUpdated: now,
      ttl: 3600 // 1 hour
    };
  }
  
  /**
   * Calculate and cache EVM analysis
   */
  private async calculateAndCacheEVM(
    projectId: string | number,
    nativeData: NativeProjectMetrics,
    variables: PMOVariables
  ): Promise<EVMCalculation> {
    const evm = customCalculator.calculateEVM(nativeData, variables);
    await cacheManager.cacheEVMCalculation(projectId, evm);
    return evm;
  }
  
  /**
   * Calculate and cache critical path analysis
   */
  private async calculateAndCacheCriticalPath(
    ctx: Ctx,
    projectId: string | number,
    nativeData: NativeProjectMetrics
  ): Promise<CriticalPathAnalysis> {
    // Get work package dependencies (simplified for now)
    const dependencies = await this.getWorkPackageDependencies(ctx, projectId);
    const criticalPath = customCalculator.calculateCriticalPath(nativeData, dependencies);
    await cacheManager.cacheCriticalPathAnalysis(projectId, criticalPath);
    return criticalPath;
  }
  
  /**
   * Calculate and cache resource utilization
   */
  private async calculateAndCacheResourceUtilization(
    ctx: Ctx,
    projectId: string | number,
    nativeData: NativeProjectMetrics,
    variables: PMOVariables
  ): Promise<ResourceUtilization[]> {
    // For single project analysis, create array with just this project
    const projectsData = [nativeData];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1); // Last month
    const endDate = new Date();
    
    const utilization = customCalculator.calculateResourceUtilization(
      projectsData,
      variables,
      startDate,
      endDate
    );
    
    await cacheManager.cacheResourceUtilization(String(projectId), utilization);
    return utilization;
  }
  
  /**
   * Get multiple projects data efficiently (for portfolio analysis)
   */
  async getMultipleProjectsData(
    ctx: Ctx, 
    projectIds: (string | number)[]
  ): Promise<HybridProjectData[]> {
    // Warm cache for better performance
    await cacheManager.warmCache(projectIds);
    
    // Process projects in parallel for efficiency
    const projectDataPromises = projectIds.map(id => this.getProjectData(ctx, id));
    
    return await Promise.all(projectDataPromises);
  }
  
  /**
   * Get portfolio-level analytics across multiple projects
   */
  async getPortfolioAnalytics(
    ctx: Ctx,
    projectIds: (string | number)[]
  ): Promise<{
    totalProjects: number;
    overallHealth: 'Green' | 'Yellow' | 'Red';
    totalBudget: number;
    totalSpent: number;
    averageProgress: number;
    riskProjects: string[];
    resourceConflicts: {
      userId: string;
      overallocation: number;
      projects: string[];
    }[];
    recommendations: string[];
  }> {
    const cacheKey = `portfolio_${projectIds.join('_')}`;
    const cached = await cacheManager.get<any>('portfolioAnalytics', cacheKey);
    
    if (cached) {
      return cached;
    }
    
    // Get all project data
    const projectsData = await this.getMultipleProjectsData(ctx, projectIds);
    
    // Aggregate portfolio metrics
    const totalProjects = projectsData.length;
    let totalBudget = 0;
    let totalSpent = 0;
    let totalProgress = 0;
    const riskProjects: string[] = [];
    const allResourceUtilization: ResourceUtilization[] = [];
    
    projectsData.forEach(project => {
      const evm = project.calculations?.evm;
      if (evm) {
        totalBudget += evm.budgetAtCompletion;
        totalSpent += evm.actualCost;
        
        if (evm.overallHealth === 'Red') {
          riskProjects.push(project.native.name);
        }
      }
      
      totalProgress += project.native.overallPercentComplete;
      
      if (project.calculations?.resourceUtilization) {
        allResourceUtilization.push(...project.calculations.resourceUtilization);
      }
    });
    
    const averageProgress = totalProjects > 0 ? totalProgress / totalProjects : 0;
    
    // Identify resource conflicts
    const resourceConflicts = this.identifyResourceConflicts(allResourceUtilization, projectsData);
    
    // Determine overall portfolio health
    const overallHealth = this.determinePortfolioHealth(projectsData);
    
    // Generate recommendations
    const recommendations = this.generatePortfolioRecommendations(projectsData, resourceConflicts);
    
    const result = {
      totalProjects,
      overallHealth,
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      averageProgress: Math.round(averageProgress * 100) / 100,
      riskProjects,
      resourceConflicts,
      recommendations
    };
    
    // Cache portfolio analytics for 2 hours
    await cacheManager.set('portfolioAnalytics', result, cacheKey, 7200);
    
    return result;
  }
  
  /**
   * Get real-time project status (never cached)
   */
  async getProjectStatus(ctx: Ctx, projectId: string | number): Promise<{
    isOnline: boolean;
    lastUpdate: string;
    currentProgress: number;
    todaysActivity: number;
    upcomingDeadlines: Array<{ task: string; date: string; daysRemaining: number }>;
    alerts: Array<{ level: 'info' | 'warning' | 'error'; message: string }>;
  }> {
    const nativeData = await nativeExtractor.getProjectMetrics(ctx, projectId);
    const statusSummary = await nativeExtractor.getProjectStatusSummary(ctx, projectId);
    
    // Calculate today's activity
    const today = new Date().toISOString().split('T')[0];
    const todaysActivity = nativeData.timeEntries
      .filter(te => te.spentOn === today)
      .reduce((sum, te) => sum + te.hours, 0);
    
    // Find upcoming deadlines
    const upcomingDeadlines = nativeData.workPackages
      .filter(wp => wp.dueDate && new Date(wp.dueDate) > new Date())
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5)
      .map(wp => ({
        task: wp.subject,
        date: wp.dueDate!,
        daysRemaining: Math.ceil(
          (new Date(wp.dueDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        )
      }));
    
    // Generate alerts
    const alerts: Array<{ level: 'info' | 'warning' | 'error'; message: string }> = [];
    
    if (statusSummary.riskLevel === 'High') {
      alerts.push({ level: 'error', message: 'Project is at high risk' });
    }
    
    if (statusSummary.issueCount > 3) {
      alerts.push({ level: 'warning', message: `${statusSummary.issueCount} open issues` });
    }
    
    if (upcomingDeadlines.some(d => d.daysRemaining <= 3)) {
      alerts.push({ level: 'warning', message: 'Deadlines approaching within 3 days' });
    }
    
    if (todaysActivity === 0) {
      alerts.push({ level: 'info', message: 'No activity logged today' });
    }
    
    return {
      isOnline: true, // OpenProject is responding
      lastUpdate: new Date().toISOString(),
      currentProgress: nativeData.overallPercentComplete,
      todaysActivity,
      upcomingDeadlines,
      alerts
    };
  }
  
  /**
   * Invalidate caches when project data changes
   */
  async invalidateProjectCache(projectId: string | number): Promise<void> {
    await cacheManager.clearProject(projectId);
    
    // Also invalidate any portfolio caches that include this project
    await cacheManager.invalidate('portfolio');
  }
  
  /**
   * Get cache performance metrics
   */
  async getCachePerformance(): Promise<{
    statistics: ReturnType<typeof cacheManager.getCacheStatistics>;
    health: ReturnType<typeof cacheManager.getHealthStatus>;
  }> {
    return {
      statistics: cacheManager.getCacheStatistics(),
      health: cacheManager.getHealthStatus()
    };
  }
  
  // Private helper methods
  
  private shouldRecalculateEVM(cached: EVMCalculation, nativeData: NativeProjectMetrics): boolean {
    // Recalculate if progress has changed significantly
    const cachedDate = new Date(cached.calculationDate);
    const daysSinceCalculation = (Date.now() - cachedDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Always recalculate if more than 1 day old
    if (daysSinceCalculation > 1) return true;
    
    // Recalculate if project has significant progress (>5% change expected)
    if (nativeData.overallPercentComplete > 80 && daysSinceCalculation > 0.5) return true;
    
    return false;
  }
  
  private shouldRecalculateCriticalPath(cached: CriticalPathAnalysis, nativeData: NativeProjectMetrics): boolean {
    const cachedDate = new Date(cached.analysisDate);
    const daysSinceCalculation = (Date.now() - cachedDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Recalculate if more than 0.5 days old (critical path changes frequently)
    return daysSinceCalculation > 0.5;
  }
  
  private shouldRecalculateResources(cached: ResourceUtilization[], nativeData: NativeProjectMetrics): boolean {
    // Resource utilization should be recalculated daily
    return true; // For now, always recalculate for fresh data
  }
  
  private async getWorkPackageDependencies(
    ctx: Ctx, 
    projectId: string | number
  ): Promise<Array<{ fromId: string; toId: string; type: string; lag?: number }>> {
    // Simplified dependency extraction - in a real implementation,
    // this would query OpenProject's relations API
    return [];
  }
  
  private assessComplexity(nativeData: NativeProjectMetrics): 'low' | 'medium' | 'high' {
    const workPackageCount = nativeData.workPackages.length;
    const timeEntryCount = nativeData.timeEntries.length;
    
    if (workPackageCount < 20 && timeEntryCount < 100) return 'low';
    if (workPackageCount < 100 && timeEntryCount < 500) return 'medium';
    return 'high';
  }
  
  private identifyResourceConflicts(
    allResourceUtilization: ResourceUtilization[],
    projectsData: HybridProjectData[]
  ): Array<{ userId: string; overallocation: number; projects: string[] }> {
    const userProjects = new Map<string, string[]>();
    const conflicts: Array<{ userId: string; overallocation: number; projects: string[] }> = [];
    
    // Build user-to-projects mapping
    allResourceUtilization.forEach(resource => {
      if (resource.overallocation) {
        const projects = resource.projects.map(p => p.projectName);
        userProjects.set(String(resource.userId), projects);
        
        conflicts.push({
          userId: resource.userId,
          overallocation: resource.utilizationRate,
          projects
        });
      }
    });
    
    return conflicts;
  }
  
  private determinePortfolioHealth(projectsData: HybridProjectData[]): 'Green' | 'Yellow' | 'Red' {
    const healthCounts = { Green: 0, Yellow: 0, Red: 0 };
    
    projectsData.forEach(project => {
      const health = project.calculations?.evm?.overallHealth || 'Yellow';
      healthCounts[health]++;
    });
    
    const totalProjects = projectsData.length;
    const redRatio = healthCounts.Red / totalProjects;
    const greenRatio = healthCounts.Green / totalProjects;
    
    if (redRatio > 0.3) return 'Red';
    if (greenRatio < 0.5) return 'Yellow';
    return 'Green';
  }
  
  private generatePortfolioRecommendations(
    projectsData: HybridProjectData[],
    resourceConflicts: Array<{ userId: string; overallocation: number; projects: string[] }>
  ): string[] {
    const recommendations: string[] = [];
    
    const riskProjects = projectsData.filter(p => p.calculations?.evm?.overallHealth === 'Red');
    if (riskProjects.length > 0) {
      recommendations.push(`Focus attention on ${riskProjects.length} high-risk projects`);
    }
    
    if (resourceConflicts.length > 0) {
      recommendations.push(`Address resource conflicts for ${resourceConflicts.length} team members`);
    }
    
    const avgProgress = projectsData.reduce((sum, p) => sum + p.native.overallPercentComplete, 0) / projectsData.length;
    if (avgProgress < 50) {
      recommendations.push('Overall portfolio progress is below 50% - consider acceleration strategies');
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const hybridManager = new HybridDataManager();