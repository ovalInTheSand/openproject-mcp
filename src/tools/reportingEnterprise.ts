// src/tools/reportingEnterprise.ts
import { z } from "zod";
import { hybridManager } from "../data/hybrid-manager";
import type { Ctx } from "../tools";
import type { HybridProjectData } from "../types/hybrid-data";

// Legacy imports for compatibility
import { opFetch, parseCollectionMeta, withQuery } from "../util/op.js";

//
// Enterprise Reporting & Analytics - EVM, Critical Path, Dashboard
// Now powered by hybrid OpenProject native + custom calculations
//

//
// Earned Value Management (PMBOK Standard)
//
export const generateEarnedValueInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID for EVM analysis"),
  
  // EVM calculation parameters
  reportDate: z.string().describe("Status date for EVM calculations (YYYY-MM-DD)"),
  baselineId: z.union([z.string(), z.number()]).optional().describe("Baseline version for comparison"),
  
  // Analysis scope
  includeSubprojects: z.boolean().default(false).describe("Include child project data"),
  workPackageIds: z.array(z.union([z.string(), z.number()])).optional().describe("Specific work packages to analyze"),
  
  // EVM options
  calculateForecasts: z.boolean().default(true).describe("Calculate ETC, EAC, and forecasts"),
  includeDetailedBreakdown: z.boolean().default(false).describe("Include WP-level EVM metrics"),
  costCurrency: z.string().default("USD").describe("Currency for cost calculations"),
  
  // Time period analysis
  periodStart: z.string().optional().describe("Start date for period analysis"),
  periodEnd: z.string().optional().describe("End date for period analysis"),
}).strict();

export async function generateEarnedValue(ctx: Ctx, input: z.infer<typeof generateEarnedValueInput>) {
  // Use hybrid data manager for comprehensive project data
  const projectData = await hybridManager.getProjectData(ctx, input.projectId);
  
  // Check if we have cached EVM calculation
  const reportDate = new Date(input.reportDate);
  if (projectData.calculations?.evm && !input.includeDetailedBreakdown) {
    const cachedEVM = projectData.calculations.evm;
    const calculationDate = new Date(cachedEVM.calculationDate);
    const isRecent = (Date.now() - calculationDate.getTime()) < 3600000; // 1 hour
    
    if (isRecent && calculationDate.toDateString() === reportDate.toDateString()) {
      return {
        ...cachedEVM,
        source: 'cached',
        detailedBreakdown: input.includeDetailedBreakdown ? await generateDetailedBreakdown(projectData, input) : undefined
      };
    }
  }
  
  // Use the hybrid calculation (native OpenProject data + custom EVM logic)
  const evmResult = projectData.calculations?.evm;
  if (!evmResult) {
    throw new Error('EVM calculation failed - insufficient project data');
  }
  
  // Normalize any null numeric fields (edge case when no data yet)
  const cleaned: any = { ...evmResult };
  for (const k of ['plannedValue','earnedValue','actualCost','budgetAtCompletion']) {
    if (cleaned[k] == null || !Number.isFinite(cleaned[k])) cleaned[k] = 0;
  }
  return {
    ...cleaned,
    source: 'calculated',
    projectName: projectData.native.name,
    currency: input.costCurrency,
    detailedBreakdown: input.includeDetailedBreakdown ? await generateDetailedBreakdown(projectData, input) : undefined
  };
}

/**
 * Generate detailed work package breakdown for EVM analysis
 */
async function generateDetailedBreakdown(
  projectData: HybridProjectData,
  input: z.infer<typeof generateEarnedValueInput>
) {
  const { native, variables } = projectData;
  const reportDate = new Date(input.reportDate);
  
  const workPackageMetrics = native.workPackages.map(wp => {
    // Calculate individual work package metrics using variables
    const estimatedHours = parseISO8601Duration(wp.estimatedTime) || variables.workingHoursPerDay;
    const budgetAtCompletion = estimatedHours * variables.standardLaborRate;
    
    // Calculate planned value based on schedule
    let plannedValue = 0;
    if (wp.startDate && wp.dueDate) {
      const startDate = new Date(wp.startDate);
      const dueDate = new Date(wp.dueDate);
      
      if (startDate <= reportDate) {
        if (reportDate >= dueDate) {
          plannedValue = budgetAtCompletion;
        } else {
          const totalDuration = dueDate.getTime() - startDate.getTime();
          const elapsedDuration = reportDate.getTime() - startDate.getTime();
          plannedValue = budgetAtCompletion * Math.max(0, Math.min(1, elapsedDuration / totalDuration));
        }
      }
    }
    
    // Earned value from OpenProject's native completion percentage
    const earnedValue = budgetAtCompletion * (wp.percentageDone / 100);
    
    // Calculate actual cost from time entries
    const wpTimeEntries = native.timeEntries.filter(te => 
      te.workPackage && String(te.workPackage.id) === String(wp.id)
    );
    
    const actualCost = wpTimeEntries.reduce((sum, te) => {
      const rate = variables.standardLaborRate; // Could be enhanced with user-specific rates
      return sum + (te.hours * rate);
    }, 0);
    
    return {
      id: wp.id,
      subject: wp.subject,
      type: wp.type.name,
      status: wp.status.name,
      assignee: wp.assignee?.name || 'Unassigned',
      budgetAtCompletion: Math.round(budgetAtCompletion * 100) / 100,
      plannedValue: Math.round(plannedValue * 100) / 100,
      earnedValue: Math.round(earnedValue * 100) / 100,
      actualCost: Math.round(actualCost * 100) / 100,
      percentComplete: wp.percentageDone,
      scheduleVariance: Math.round((earnedValue - plannedValue) * 100) / 100,
      costVariance: Math.round((earnedValue - actualCost) * 100) / 100,
      schedulePerformanceIndex: plannedValue > 0 ? Math.round((earnedValue / plannedValue) * 1000) / 1000 : 1,
      costPerformanceIndex: actualCost > 0 ? Math.round((earnedValue / actualCost) * 1000) / 1000 : 1,
      startDate: wp.startDate,
      dueDate: wp.dueDate,
      estimatedHours,
      actualHours: wpTimeEntries.reduce((sum, te) => sum + te.hours, 0)
    };
  });
  
  return {
    workPackages: workPackageMetrics,
    summary: {
      totalWorkPackages: workPackageMetrics.length,
      completedWorkPackages: workPackageMetrics.filter(wp => wp.percentComplete === 100).length,
      inProgressWorkPackages: workPackageMetrics.filter(wp => wp.percentComplete > 0 && wp.percentComplete < 100).length,
      notStartedWorkPackages: workPackageMetrics.filter(wp => wp.percentComplete === 0).length
    }
  };
}

//
// Critical Path Analysis (Enterprise Feature)
//
export const generateCriticalPathInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID for critical path analysis"),
  
  // Analysis parameters
  calculateDate: z.string().default(new Date().toISOString().split('T')[0]).describe("Date for analysis (YYYY-MM-DD)"),
  
  // Options
  includeFloat: z.boolean().default(true).describe("Include float calculations"),
  floatThreshold: z.number().default(5).describe("Float threshold for highlighting (days)"),
  includeRiskAssessment: z.boolean().default(true).describe("Include schedule risk assessment"),
}).strict();

export async function generateCriticalPath(ctx: Ctx, input: z.infer<typeof generateCriticalPathInput>) {
  // Get project data using hybrid manager
  const projectData = await hybridManager.getProjectData(ctx, input.projectId);
  
  // Check for cached critical path analysis
  if (projectData.calculations?.criticalPath) {
    const cached = projectData.calculations.criticalPath;
    const calculationDate = new Date(cached.analysisDate);
    const isRecent = (Date.now() - calculationDate.getTime()) < 1800000; // 30 minutes
    
    if (isRecent) {
      return {
        ...cached,
        source: 'cached',
        projectName: projectData.native.name
      };
    }
  }
  
  // Use the hybrid calculation
  const criticalPathResult = projectData.calculations?.criticalPath;
  if (!criticalPathResult) {
    throw new Error('Critical path analysis failed - insufficient dependency data');
  }
  
  return {
    ...criticalPathResult,
    source: 'calculated',
    projectName: projectData.native.name
  };
}

//
// Project Dashboard (Comprehensive KPIs)
//
export const generateProjectDashboardInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID for dashboard generation"),
  
  // Dashboard scope
  includeEVM: z.boolean().default(true).describe("Include Earned Value Management metrics"),
  includeCriticalPath: z.boolean().default(true).describe("Include critical path analysis"),
  includeResourceUtilization: z.boolean().default(true).describe("Include resource utilization"),
  includeRiskAssessment: z.boolean().default(false).describe("Include risk assessment"),
  
  // Time period for analysis
  customStartDate: z.string().optional().describe("Custom start date for analysis (YYYY-MM-DD)"),
  customEndDate: z.string().optional().describe("Custom end date for analysis (YYYY-MM-DD)"),
}).strict();

export async function generateProjectDashboard(ctx: Ctx, input: z.infer<typeof generateProjectDashboardInput>) {
  // Get comprehensive project data
  const projectData = await hybridManager.getProjectData(ctx, input.projectId);
  const projectStatus = await hybridManager.getProjectStatus(ctx, input.projectId);
  
  const dashboard: any = {
    project: {
      id: projectData.native.id,
      name: projectData.native.name,
      identifier: projectData.native.identifier,
      status: projectData.native.status,
      lastUpdated: new Date().toISOString()
    },
    
    // Real-time status from OpenProject
    realTimeStatus: projectStatus,
    
    // Core metrics from native OpenProject calculations
    coreMetrics: {
      totalWorkPackages: projectData.native.totalWorkPackages,
      completedWorkPackages: projectData.native.completedWorkPackages,
      activeWorkPackages: projectData.native.activeWorkPackages,
      overallProgress: projectData.native.overallPercentComplete,
      totalEstimatedHours: projectData.native.totalEstimatedHours,
      totalSpentHours: projectData.native.totalSpentHours,
      efficiency: projectData.native.totalEstimatedHours > 0 
        ? Math.round((projectData.native.totalSpentHours / projectData.native.totalEstimatedHours) * 100) / 100
        : 1
    }
  };
  
  // Add EVM analysis if requested
  if (input.includeEVM && projectData.calculations?.evm) {
    dashboard.earnedValueManagement = projectData.calculations.evm;
  }
  
  // Add critical path analysis if requested
  if (input.includeCriticalPath && projectData.calculations?.criticalPath) {
    dashboard.criticalPathAnalysis = {
      projectDuration: projectData.calculations.criticalPath.projectDuration,
      criticalPathLength: projectData.calculations.criticalPath.criticalPathLength,
      scheduleRisk: projectData.calculations.criticalPath.scheduleRisk,
      recommendations: projectData.calculations.criticalPath.recommendations
    };
  }
  
  // Add resource utilization if requested
  if (input.includeResourceUtilization && projectData.calculations?.resourceUtilization) {
    dashboard.resourceUtilization = {
      totalResources: projectData.calculations.resourceUtilization.length,
      overallocatedResources: projectData.calculations.resourceUtilization.filter(r => r.overallocation).length,
      averageUtilization: projectData.calculations.resourceUtilization.reduce(
        (sum, r) => sum + r.utilizationRate, 0
      ) / Math.max(1, projectData.calculations.resourceUtilization.length)
    };
  }
  
  // PMO configuration summary
  dashboard.pmoConfiguration = {
    standardLaborRate: projectData.variables.standardLaborRate,
    costPerformanceThreshold: projectData.variables.costPerformanceThreshold,
    schedulePerformanceThreshold: projectData.variables.schedulePerformanceThreshold,
    evmMethod: projectData.variables.evmMethod,
    industryType: projectData.variables.industryType
  };
  
  return dashboard;
}

// Helper function to parse ISO 8601 duration
function parseISO8601Duration(duration?: string): number {
  if (!duration) return 0;
  
  const match = duration.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)D)?$/);
  if (!match) return 0;
  
  const hours = parseFloat(match[1] || '0');
  const days = parseFloat(match[2] || '0');
  
  return hours + (days * 8); // Assume 8 hours per day
}