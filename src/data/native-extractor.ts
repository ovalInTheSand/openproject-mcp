// src/data/native-extractor.ts
import { opFetch, parseCollectionMeta, withQuery } from "../util/op";
import type { 
  NativeProjectMetrics, 
  NativeWorkPackageData, 
  NativeTimeEntry, 
  NativeBudgetData 
} from "../types/hybrid-data";
import type { Ctx } from "../tools";

/**
 * Native OpenProject Data Extractor
 * 
 * Extracts calculated data directly from OpenProject API without modification.
 * This leverages OpenProject's native calculation engine for maximum accuracy
 * and performance.
 */
export class NativeOpenProjectExtractor {
  
  /**
   * Extract comprehensive project metrics using OpenProject's native calculations
   */
  async getProjectMetrics(ctx: Ctx, projectId: string | number): Promise<NativeProjectMetrics> {
    const { env } = ctx;
    
    // Get project info
    const { json: project } = await opFetch<any>(env, `/api/v3/projects/${projectId}`);
    
    // Get all work packages with their native calculated fields
    const wpData = await this.getWorkPackagesData(ctx, projectId);
    
    // Get time entries for cost calculations
    const timeEntries = await this.getTimeEntriesData(ctx, projectId);
    
    // Get budget data (limited by OpenProject API)
    const budgetInfo = await this.getBudgetData(ctx, projectId);
    
    // Calculate aggregated metrics using OpenProject's native data
    const metrics = this.calculateAggregatedMetrics(wpData.workPackages, timeEntries);
    
    return {
      id: project.id,
      name: project.name,
      identifier: project.identifier,
      status: project.status || 'active',
      statusExplanation: project.statusExplanation,
      
      // Use OpenProject's native calculated values
      ...metrics,
      
      // Raw data for custom calculations
      workPackages: wpData.workPackages,
      timeEntries,
      budgetInfo,
    };
  }
  
  /**
   * Get work packages with all native OpenProject calculated fields
   */
  private async getWorkPackagesData(ctx: Ctx, projectId: string | number): Promise<{
    workPackages: NativeWorkPackageData[];
    meta: any;
  }> {
    const { env } = ctx;
    
    // Get work packages with full details
    const params: Record<string, unknown> = {
      pageSize: 1000, // Large page size to get most projects in one call
      sortBy: JSON.stringify([["id", "asc"]]),
      // Removed non-standard 'select' parameter to ensure compatibility
    };
    
    const { json } = await opFetch<any>(env, `/api/v3/projects/${projectId}/work_packages`, {
      params
    });
    
    const meta = parseCollectionMeta(json);
    const workPackages: NativeWorkPackageData[] = (json?._embedded?.elements || []).map((wp: any) => ({
      id: wp.id,
      subject: wp.subject,
      percentageDone: wp.percentageDone || 0, // OpenProject's native calculation
      estimatedTime: wp.estimatedTime,
      spentTime: wp.spentTime,
      startDate: wp.startDate,
      dueDate: wp.dueDate,
      status: {
        id: wp._links?.status?.href?.split('/').pop() || 'unknown',
        name: wp.status?.name || 'Unknown',
        isClosed: wp.status?.isClosed || false
      },
      type: {
        id: wp._links?.type?.href?.split('/').pop() || 'unknown',
        name: wp.type?.name || 'Unknown'
      },
      assignee: wp._links?.assignee ? {
        id: wp._links.assignee.href.split('/').pop(),
        name: wp.assignee?.name || 'Unknown'
      } : undefined,
      _links: wp._links
    }));
    
    return { workPackages, meta };
  }
  
  /**
   * Get time entries with native OpenProject data
   */
  private async getTimeEntriesData(ctx: Ctx, projectId: string | number): Promise<NativeTimeEntry[]> {
    const { env } = ctx;
    
    const params: Record<string, unknown> = {
      pageSize: 1000,
      sortBy: JSON.stringify([['spentOn', 'desc']]),
      filters: JSON.stringify([
        { project: { operator: '=', values: [String(projectId)] }}
      ])
    };
    
    const { json } = await opFetch<any>(env, '/api/v3/time_entries', { params });
    
    return (json?._embedded?.elements || []).map((te: any) => ({
      id: te.id,
      hours: te.hours || 0, // OpenProject's native hours tracking
      spentOn: te.spentOn,
      comment: te.comment,
      user: {
        id: te._links?.user?.href?.split('/').pop() || 'unknown',
        name: te.user?.name || 'Unknown'
      },
      workPackage: te._links?.workPackage ? {
        id: te._links.workPackage.href.split('/').pop(),
        subject: te.workPackage?.subject || 'Unknown'
      } : undefined,
      project: {
        id: te._links?.project?.href?.split('/').pop() || projectId,
        name: te.project?.name || 'Unknown'
      },
      activity: te._links?.activity ? {
        id: te._links.activity.href.split('/').pop(),
        name: te.activity?.name || 'Unknown'
      } : undefined
    }));
  }
  
  /**
   * Get budget data (currently limited by OpenProject API)
   */
  private async getBudgetData(ctx: Ctx, projectId: string | number): Promise<NativeBudgetData | undefined> {
    const { env } = ctx;
    
    try {
      const { json } = await opFetch<any>(env, `/api/v3/projects/${projectId}/budgets`);
      
      if (json?._embedded?.elements?.length > 0) {
        const budget = json._embedded.elements[0];
        return {
          id: budget.id,
          subject: budget.subject
          // Note: OpenProject budget API is minimal, we'll extend via custom fields
        };
      }
    } catch (error) {
      // Budget module might not be enabled or no budgets exist
      console.warn(`No budget data available for project ${projectId}:`, error);
    }
    
    return undefined;
  }
  
  /**
   * Calculate aggregated metrics from native OpenProject data
   */
  private calculateAggregatedMetrics(
    workPackages: NativeWorkPackageData[], 
    timeEntries: NativeTimeEntry[]
  ) {
    // Use OpenProject's native calculated values where possible
    const totalEstimatedHours = workPackages.reduce((sum, wp) => {
      const hours = this.parseISO8601Duration(wp.estimatedTime);
      return sum + hours;
    }, 0);
    
    const totalSpentHours = timeEntries.reduce((sum, te) => sum + te.hours, 0);
    
    // Calculate overall completion using OpenProject's percentageDone values
    const totalWorkPackages = workPackages.length;
    const completedWorkPackages = workPackages.filter(wp => wp.status.isClosed).length;
    const activeWorkPackages = totalWorkPackages - completedWorkPackages;
    
    // Weighted average completion based on estimated hours
    let totalWeightedCompletion = 0;
    let totalWeight = 0;
    
    workPackages.forEach(wp => {
      const weight = this.parseISO8601Duration(wp.estimatedTime) || 1; // Default weight of 1 if no estimate
      totalWeightedCompletion += (wp.percentageDone / 100) * weight;
      totalWeight += weight;
    });
    
    const overallPercentComplete = totalWeight > 0 ? (totalWeightedCompletion / totalWeight) * 100 : 0;
    
    return {
      totalEstimatedHours,
      totalSpentHours,
      overallPercentComplete: Math.round(overallPercentComplete * 100) / 100,
      activeWorkPackages,
      completedWorkPackages,
      totalWorkPackages
    };
  }
  
  /**
   * Parse ISO 8601 duration to hours (OpenProject format: PT8H, PT1D, etc.)
   */
  private parseISO8601Duration(duration?: string): number {
    if (!duration) return 0;
    
    // Match PT followed by numbers and units (H for hours, D for days)
    const match = duration.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)D)?$/);
    if (!match) return 0;
    
    const hours = parseFloat(match[1] || '0');
    const days = parseFloat(match[2] || '0');
    
    // Assume 8 hours per day for day-to-hour conversion
    return hours + (days * 8);
  }
  
  /**
   * Get project-specific configuration data from OpenProject
   */
  async getProjectConfiguration(ctx: Ctx, projectId: string | number): Promise<{
    types: any[];
    statuses: any[];
    priorities: any[];
    users: any[];
    customFields: any[];
  }> {
    const { env } = ctx;
    
    // Get all configuration data in parallel for efficiency
    const [typesData, statusesData, prioritiesData, usersData, customFieldsData] = await Promise.all([
      opFetch<any>(env, `/api/v3/projects/${projectId}/types`).then(r => r.json?._embedded?.elements || []),
      opFetch<any>(env, '/api/v3/statuses').then(r => r.json?._embedded?.elements || []),
      opFetch<any>(env, '/api/v3/priorities').then(r => r.json?._embedded?.elements || []),
      opFetch<any>(env, `/api/v3/projects/${projectId}/memberships`).then(r => r.json?._embedded?.elements?.map((m: any) => m.user) || []),
      this.getProjectCustomFields(ctx, projectId)
    ]);
    
    return {
      types: typesData,
      statuses: statusesData,
      priorities: prioritiesData,
      users: usersData,
      customFields: customFieldsData
    };
  }
  
  /**
   * Get project custom fields (for PMO variables storage)
   */
  private async getProjectCustomFields(ctx: Ctx, projectId: string | number): Promise<any[]> {
    const { env } = ctx;
    
    try {
      // Get project schema which includes custom field definitions
      const { json: schema } = await opFetch<any>(env, `/api/v3/projects/${projectId}/form`);
      
      // Extract custom field definitions from schema
      const customFields: any[] = [];
      
      if (schema?._embedded?.schema) {
        Object.entries(schema._embedded.schema).forEach(([key, value]: [string, any]) => {
          if (key.startsWith('customField')) {
            customFields.push({
              key,
              name: value.name,
              type: value.type,
              required: value.required,
              hasDefault: value.hasDefault,
              writable: value.writable
            });
          }
        });
      }
      
      return customFields;
    } catch (error) {
      console.warn(`Could not fetch custom fields for project ${projectId}:`, error);
      return [];
    }
  }
  
  /**
   * Get real-time project status summary
   */
  async getProjectStatusSummary(ctx: Ctx, projectId: string | number): Promise<{
    isHealthy: boolean;
    issueCount: number;
    riskLevel: 'Low' | 'Medium' | 'High';
    nextMilestone?: {
      name: string;
      date: string;
      daysRemaining: number;
    };
  }> {
    const metrics = await this.getProjectMetrics(ctx, projectId);
    
    // Calculate health based on native OpenProject data
    const completionRate = metrics.overallPercentComplete;
    const hasOverdueItems = metrics.workPackages.some(wp => 
      wp.dueDate && new Date(wp.dueDate) < new Date() && !wp.status.isClosed
    );
    
    const issueCount = metrics.workPackages.filter(wp => 
      wp.subject.toLowerCase().includes('issue') || 
      wp.subject.toLowerCase().includes('bug') ||
      wp.subject.toLowerCase().includes('problem')
    ).length;
    
    // Simple risk assessment based on native data
    let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
    if (hasOverdueItems || completionRate < 50) riskLevel = 'Medium';
    if (issueCount > 5 || completionRate < 25) riskLevel = 'High';
    
    // Find next milestone
    const upcomingMilestone = metrics.workPackages
      .filter(wp => wp.dueDate && new Date(wp.dueDate) > new Date())
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];
    
    return {
      isHealthy: !hasOverdueItems && completionRate > 25 && issueCount <= 5,
      issueCount,
      riskLevel,
      nextMilestone: upcomingMilestone ? {
        name: upcomingMilestone.subject,
        date: upcomingMilestone.dueDate!,
        daysRemaining: Math.ceil(
          (new Date(upcomingMilestone.dueDate!).getTime() - new Date().getTime()) / 
          (1000 * 60 * 60 * 24)
        )
      } : undefined
    };
  }
}

// Export singleton instance
export const nativeExtractor = new NativeOpenProjectExtractor();