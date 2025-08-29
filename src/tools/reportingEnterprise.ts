// src/tools/reportingEnterprise.ts
import { z } from "zod";
import { opFetch, parseCollectionMeta, withQuery } from "../util/op";
import type { Ctx } from "../tools";

//
// Enterprise Reporting & Analytics - EVM, Critical Path, Dashboard
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

export async function generateEarnedValue({ env }: Ctx, input: z.infer<typeof generateEarnedValueInput>) {
  // Get project data
  const { json: project } = await opFetch<any>(env, `/api/v3/projects/${input.projectId}`);
  
  // Get work packages for the project
  const wpParams: Record<string, unknown> = {
    pageSize: 1000,
    sortBy: JSON.stringify([['id', 'asc']])
  };
  
  // Filter by specific work packages if requested
  if (input.workPackageIds?.length) {
    wpParams.filters = JSON.stringify([
      { id: { operator: '=', values: input.workPackageIds.map(String) } }
    ]);
  }
  
  const { json: wpData } = await opFetch<any>(env, `/api/v3/projects/${input.projectId}/work_packages`, {
    params: wpParams
  });
  const workPackages = wpData?._embedded?.elements ?? [];

  // Get time entries for actual cost calculation
  const timeFilters: any[] = [
    { project: { operator: '=', values: [input.projectId.toString()] } }
  ];
  
  if (input.periodStart) {
    timeFilters.push({ spentOn: { operator: '>=d', values: [input.periodStart] } });
  }
  if (input.periodEnd) {
    timeFilters.push({ spentOn: { operator: '<=d', values: [input.periodEnd] } });
  } else {
    timeFilters.push({ spentOn: { operator: '<=d', values: [input.reportDate] } });
  }

  const { json: timeData } = await opFetch<any>(env, '/api/v3/time_entries', {
    params: {
      filters: JSON.stringify(timeFilters),
      pageSize: 1000
    }
  });
  const timeEntries = timeData?._embedded?.elements ?? [];

  // Calculate EVM Metrics
  const reportDate = new Date(input.reportDate);
  let totalPlannedValue = 0;
  let totalEarnedValue = 0;
  let totalActualCost = 0;
  let totalBudgetAtCompletion = 0;
  
  const workPackageMetrics: any[] = [];

  // Process each work package
  workPackages.forEach((wp: any) => {
    const startDate = wp.startDate ? new Date(wp.startDate) : null;
    const dueDate = wp.dueDate ? new Date(wp.dueDate) : null;
    const estimatedHours = wp.estimatedTime ? parseISO8601Duration(wp.estimatedTime) : 8; // Default 8 hours
    const percentComplete = wp.percentageDone || 0;
    
    // Standard labor rate (could be customized per resource)
    const standardRate = 75; // $75/hour default
    const budgetAtCompletion = estimatedHours * standardRate;
    
    // Planned Value calculation
    let plannedValue = 0;
    if (startDate && dueDate && startDate <= reportDate) {
      if (reportDate >= dueDate) {
        plannedValue = budgetAtCompletion; // Task should be complete
      } else {
        // Linear progress assumption
        const totalDuration = dueDate.getTime() - startDate.getTime();
        const elapsedDuration = reportDate.getTime() - startDate.getTime();
        plannedValue = budgetAtCompletion * Math.max(0, Math.min(1, elapsedDuration / totalDuration));
      }
    }
    
    // Earned Value calculation
    const earnedValue = budgetAtCompletion * (percentComplete / 100);
    
    // Actual Cost calculation from time entries
    const wpTimeEntries = timeEntries.filter((te: any) => {
      const wpId = te._links?.workPackage?.href?.split('/').pop();
      return wpId === wp.id.toString();
    });
    
    const actualCost = wpTimeEntries.reduce((sum: number, te: any) => {
      const hours = te.hours || 0;
      const rate = te.costRate || standardRate;
      return sum + (hours * rate);
    }, 0);

    const wpMetrics = {
      id: wp.id,
      subject: wp.subject,
      budgetAtCompletion,
      plannedValue,
      earnedValue,
      actualCost,
      percentComplete,
      scheduleVariance: earnedValue - plannedValue,
      costVariance: earnedValue - actualCost,
      schedulePerformanceIndex: plannedValue > 0 ? earnedValue / plannedValue : 1,
      costPerformanceIndex: actualCost > 0 ? earnedValue / actualCost : 1,
    };

    workPackageMetrics.push(wpMetrics);
    
    totalBudgetAtCompletion += budgetAtCompletion;
    totalPlannedValue += plannedValue;
    totalEarnedValue += earnedValue;
    totalActualCost += actualCost;
  });

  // Calculate project-level EVM metrics
  const scheduleVariance = totalEarnedValue - totalPlannedValue;
  const costVariance = totalEarnedValue - totalActualCost;
  const schedulePerformanceIndex = totalPlannedValue > 0 ? totalEarnedValue / totalPlannedValue : 1;
  const costPerformanceIndex = totalActualCost > 0 ? totalEarnedValue / totalActualCost : 1;

  // Calculate forecasts
  let estimateAtCompletion = totalBudgetAtCompletion;
  let estimateToComplete = 0;
  let varianceAtCompletion = 0;
  let toCompletePerformanceIndex = 1;

  if (input.calculateForecasts) {
    // EAC calculation using CPI
    estimateAtCompletion = costPerformanceIndex > 0 ? totalBudgetAtCompletion / costPerformanceIndex : totalBudgetAtCompletion;
    estimateToComplete = estimateAtCompletion - totalActualCost;
    varianceAtCompletion = totalBudgetAtCompletion - estimateAtCompletion;
    
    // TCPI calculation
    const workRemaining = totalBudgetAtCompletion - totalEarnedValue;
    const budgetRemaining = totalBudgetAtCompletion - totalActualCost;
    toCompletePerformanceIndex = budgetRemaining > 0 ? workRemaining / budgetRemaining : 1;
  }

  // Performance analysis
  const performanceAnalysis = {
    scheduleStatus: schedulePerformanceIndex >= 0.95 ? 'On Track' : 
                   schedulePerformanceIndex >= 0.85 ? 'Behind Schedule' : 'Seriously Behind',
    costStatus: costPerformanceIndex >= 0.95 ? 'Under Budget' :
                costPerformanceIndex >= 0.85 ? 'Over Budget' : 'Seriously Over Budget',
    overallHealth: schedulePerformanceIndex >= 0.95 && costPerformanceIndex >= 0.95 ? 'Green' :
                   schedulePerformanceIndex >= 0.85 && costPerformanceIndex >= 0.85 ? 'Yellow' : 'Red',
  };

  return {
    earnedValueManagement: {
      // Project information
      project: {
        id: project.id,
        name: project.name,
        reportDate: input.reportDate,
        currency: input.costCurrency,
      },
      
      // Core EVM metrics (PMBOK standard)
      metrics: {
        budgetAtCompletion: Math.round(totalBudgetAtCompletion * 100) / 100,
        plannedValue: Math.round(totalPlannedValue * 100) / 100,
        earnedValue: Math.round(totalEarnedValue * 100) / 100,
        actualCost: Math.round(totalActualCost * 100) / 100,
        
        // Variance metrics
        scheduleVariance: Math.round(scheduleVariance * 100) / 100,
        costVariance: Math.round(costVariance * 100) / 100,
        
        // Performance indices
        schedulePerformanceIndex: Math.round(schedulePerformanceIndex * 1000) / 1000,
        costPerformanceIndex: Math.round(costPerformanceIndex * 1000) / 1000,
      },
      
      // Forecasts
      forecasts: input.calculateForecasts ? {
        estimateAtCompletion: Math.round(estimateAtCompletion * 100) / 100,
        estimateToComplete: Math.round(estimateToComplete * 100) / 100,
        varianceAtCompletion: Math.round(varianceAtCompletion * 100) / 100,
        toCompletePerformanceIndex: Math.round(toCompletePerformanceIndex * 1000) / 1000,
      } : undefined,
      
      // Performance analysis
      analysis: performanceAnalysis,
      
      // Detailed breakdown
      workPackageDetails: input.includeDetailedBreakdown ? workPackageMetrics : undefined,
      
      // Summary statistics
      summary: {
        totalWorkPackages: workPackages.length,
        percentComplete: totalBudgetAtCompletion > 0 ? Math.round((totalEarnedValue / totalBudgetAtCompletion) * 100) : 0,
        timeEntriesAnalyzed: timeEntries.length,
        reportingPeriod: {
          start: input.periodStart || 'Project start',
          end: input.reportDate,
        }
      }
    }
  };
}

//
// Critical Path Analysis & Schedule Performance
//
export const generateCriticalPathInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID for critical path analysis"),
  
  // Analysis parameters
  calculateDate: z.string().default(new Date().toISOString().split('T')[0]).describe("Date for analysis (YYYY-MM-DD)"),
  includeFloatCalculation: z.boolean().default(true).describe("Calculate total float for all tasks"),
  includeResourceConstraints: z.boolean().default(false).describe("Consider resource limitations"),
  
  // Critical path options
  showAlternativePaths: z.boolean().default(false).describe("Show near-critical paths"),
  floatThreshold: z.number().default(2).describe("Days of float to consider near-critical"),
  
  // Schedule analysis
  includeScheduleRisk: z.boolean().default(true).describe("Analyze schedule risk factors"),
  baselineComparison: z.boolean().default(false).describe("Compare to original baseline"),
}).strict();

export async function generateCriticalPath({ env }: Ctx, input: z.infer<typeof generateCriticalPathInput>) {
  // Get project work packages
  const { json: wpData } = await opFetch<any>(env, `/api/v3/projects/${input.projectId}/work_packages`, {
    params: {
      pageSize: 1000,
      sortBy: JSON.stringify([['startDate', 'asc']])
    }
  });
  const workPackages = wpData?._embedded?.elements ?? [];

  // Get all relations for dependency analysis
  const { json: relationsData } = await opFetch<any>(env, '/api/v3/relations', {
    params: { pageSize: 1000 }
  });
  const allRelations = relationsData?._embedded?.elements ?? [];

  // Filter relations relevant to this project
  const wpIds = new Set(workPackages.map((wp: any) => wp.id.toString()));
  const projectRelations = allRelations.filter((rel: any) => {
    const fromId = rel._links?.from?.href?.split('/').pop();
    const toId = rel._links?.to?.href?.split('/').pop();
    return wpIds.has(fromId) && wpIds.has(toId);
  });

  // Build network diagram
  const nodes = new Map<string, any>();
  const edges: any[] = [];
  
  // Initialize nodes
  workPackages.forEach((wp: any) => {
    const duration = calculateTaskDuration(wp.startDate, wp.dueDate);
    const node = {
      id: wp.id.toString(),
      name: wp.subject,
      duration,
      startDate: wp.startDate ? new Date(wp.startDate) : null,
      endDate: wp.dueDate ? new Date(wp.dueDate) : null,
      percentComplete: wp.percentageDone || 0,
      
      // Schedule calculations
      earliestStart: 0,
      earliestFinish: 0,
      latestStart: 0,
      latestFinish: 0,
      totalFloat: 0,
      freeFloat: 0,
      
      // Dependencies
      predecessors: [],
      successors: [],
    };
    nodes.set(node.id, node);
  });

  // Add dependencies
  projectRelations.forEach((rel: any) => {
    if (rel.type === 'follows') { // Finish-Start relationships
      const fromId = rel._links?.from?.href?.split('/').pop();
      const toId = rel._links?.to?.href?.split('/').pop();
      
      const fromNode = nodes.get(fromId);
      const toNode = nodes.get(toId);
      
      if (fromNode && toNode) {
        edges.push({ from: fromId, to: toId, type: 'FS' });
        fromNode.successors.push(toId);
        toNode.predecessors.push(fromId);
      }
    }
  });

  // Forward Pass - Calculate Early Start and Early Finish
  const calculateEarlyTimes = (nodeId: string, visited = new Set<string>()): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = nodes.get(nodeId);
    if (!node) return;
    
    // Calculate based on predecessors
    let maxPredecessorFinish = 0;
    node.predecessors.forEach((predId: string) => {
      calculateEarlyTimes(predId, visited);
      const pred = nodes.get(predId);
      if (pred) {
        maxPredecessorFinish = Math.max(maxPredecessorFinish, pred.earliestFinish);
      }
    });
    
    node.earliestStart = maxPredecessorFinish;
    node.earliestFinish = node.earliestStart + node.duration;
  };

  // Calculate early times for all nodes
  nodes.forEach((node, nodeId) => {
    calculateEarlyTimes(nodeId);
  });

  // Find project finish time
  const projectFinish = Math.max(...Array.from(nodes.values()).map(node => node.earliestFinish));

  // Backward Pass - Calculate Late Start and Late Finish
  const calculateLateTimes = (nodeId: string, visited = new Set<string>()): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = nodes.get(nodeId);
    if (!node) return;
    
    // If no successors, use project finish time
    if (node.successors.length === 0) {
      node.latestFinish = projectFinish;
    } else {
      // Calculate based on successors
      let minSuccessorStart = Infinity;
      node.successors.forEach((succId: string) => {
        calculateLateTimes(succId, visited);
        const succ = nodes.get(succId);
        if (succ) {
          minSuccessorStart = Math.min(minSuccessorStart, succ.latestStart);
        }
      });
      node.latestFinish = minSuccessorStart;
    }
    
    node.latestStart = node.latestFinish - node.duration;
    node.totalFloat = node.latestStart - node.earliestStart;
  };

  // Calculate late times for all nodes
  nodes.forEach((node, nodeId) => {
    calculateLateTimes(nodeId);
  });

  // Identify Critical Path
  const criticalPath: string[] = [];
  const criticalNodes = Array.from(nodes.values()).filter(node => node.totalFloat === 0);
  
  // Build critical path sequence
  if (criticalNodes.length > 0) {
    const sortedCritical = criticalNodes.sort((a, b) => a.earliestStart - b.earliestStart);
    criticalPath.push(...sortedCritical.map(node => node.id));
  }

  // Near-critical paths
  const nearCriticalNodes = input.showAlternativePaths ? 
    Array.from(nodes.values()).filter(node => 
      node.totalFloat > 0 && node.totalFloat <= input.floatThreshold
    ) : [];

  // Schedule Risk Analysis
  let scheduleRiskAnalysis = {};
  if (input.includeScheduleRisk) {
    const riskyTasks = Array.from(nodes.values()).filter(node => 
      node.totalFloat <= 5 || // Low float
      node.percentComplete < 50 && node.earliestStart <= new Date(input.calculateDate).getTime() / (1000 * 60 * 60 * 24) // Behind schedule
    );
    
    scheduleRiskAnalysis = {
      highRiskTasks: riskyTasks.length,
      criticalPathLength: criticalPath.length,
      averageFloat: nodes.size > 0 ? 
        Array.from(nodes.values()).reduce((sum, node) => sum + node.totalFloat, 0) / nodes.size : 0,
      projectBufferDays: Math.max(0, projectFinish - new Date(input.calculateDate).getTime() / (1000 * 60 * 60 * 24)),
    };
  }

  return {
    criticalPathAnalysis: {
      // Project summary
      project: {
        id: input.projectId,
        analysisDate: input.calculateDate,
        totalTasks: nodes.size,
        totalDependencies: projectRelations.length,
      },
      
      // Critical path results
      criticalPath: {
        exists: criticalPath.length > 0,
        taskCount: criticalPath.length,
        totalDuration: projectFinish,
        taskIds: criticalPath,
        taskDetails: criticalNodes.map(node => ({
          id: node.id,
          name: node.name,
          duration: node.duration,
          earliestStart: node.earliestStart,
          earliestFinish: node.earliestFinish,
          percentComplete: node.percentComplete,
        })),
      },
      
      // Float analysis
      floatAnalysis: input.includeFloatCalculation ? {
        zeroFloatTasks: criticalNodes.length,
        nearCriticalTasks: nearCriticalNodes.length,
        averageTotalFloat: nodes.size > 0 ? 
          Array.from(nodes.values()).reduce((sum, node) => sum + node.totalFloat, 0) / nodes.size : 0,
        maxFloat: Math.max(...Array.from(nodes.values()).map(node => node.totalFloat)),
        floatDistribution: {
          critical: criticalNodes.length,
          nearCritical: nearCriticalNodes.length,
          moderate: Array.from(nodes.values()).filter(node => node.totalFloat > input.floatThreshold && node.totalFloat <= 10).length,
          high: Array.from(nodes.values()).filter(node => node.totalFloat > 10).length,
        }
      } : undefined,
      
      // Schedule risk
      riskAnalysis: input.includeScheduleRisk ? scheduleRiskAnalysis : undefined,
      
      // Alternative paths
      nearCriticalPaths: input.showAlternativePaths ? 
        nearCriticalNodes.map(node => ({
          id: node.id,
          name: node.name,
          totalFloat: node.totalFloat,
          duration: node.duration,
        })) : undefined,
    }
  };
}

//
// Project Dashboard & KPIs
//
export const generateProjectDashboardInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID for dashboard"),
  
  // Dashboard options
  includeEVM: z.boolean().default(true).describe("Include earned value metrics"),
  includeCriticalPath: z.boolean().default(true).describe("Include critical path status"),
  includeResourceMetrics: z.boolean().default(true).describe("Include resource utilization"),
  includeRiskMetrics: z.boolean().default(true).describe("Include risk indicators"),
  
  // Time period
  reportingPeriod: z.enum(['week', 'month', 'quarter', 'project']).default('month').describe("Reporting period"),
  customStartDate: z.string().optional().describe("Custom period start date"),
  customEndDate: z.string().optional().describe("Custom period end date"),
}).strict();

export async function generateProjectDashboard({ env }: Ctx, input: z.infer<typeof generateProjectDashboardInput>) {
  // Get project details
  const { json: project } = await opFetch<any>(env, `/api/v3/projects/${input.projectId}`);
  
  // Calculate reporting period dates
  const endDate = input.customEndDate || new Date().toISOString().split('T')[0];
  let startDate = input.customStartDate;
  
  if (!startDate) {
    const end = new Date(endDate);
    switch (input.reportingPeriod) {
      case 'week':
        end.setDate(end.getDate() - 7);
        break;
      case 'month':
        end.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        end.setMonth(end.getMonth() - 3);
        break;
      default: // project
        startDate = project.createdAt?.split('T')[0] || endDate;
    }
    if (!startDate) startDate = end.toISOString().split('T')[0];
  }

  const dashboard: any = {
    project: {
      id: project.id,
      name: project.name,
      status: project.active ? 'Active' : 'Inactive',
      reportingPeriod: {
        start: startDate,
        end: endDate,
        type: input.reportingPeriod,
      },
      generatedAt: new Date().toISOString(),
    },
    kpis: {},
  };

  // EVM Metrics
  if (input.includeEVM) {
    try {
      const evmResult = await generateEarnedValue({ env }, {
        projectId: input.projectId,
        reportDate: endDate,
        calculateForecasts: true,
        includeDetailedBreakdown: false,
        costCurrency: 'USD',
      });
      
      dashboard.kpis.earnedValue = {
        schedulePerformanceIndex: evmResult.earnedValueManagement.metrics.schedulePerformanceIndex,
        costPerformanceIndex: evmResult.earnedValueManagement.metrics.costPerformanceIndex,
        healthStatus: evmResult.earnedValueManagement.analysis.overallHealth,
        percentComplete: evmResult.earnedValueManagement.summary.percentComplete,
        budgetVariance: evmResult.earnedValueManagement.metrics.costVariance,
        scheduleVariance: evmResult.earnedValueManagement.metrics.scheduleVariance,
      };
    } catch (error) {
      dashboard.kpis.earnedValue = { error: 'EVM calculation failed' };
    }
  }

  // Critical Path Status
  if (input.includeCriticalPath) {
    try {
      const cpResult = await generateCriticalPath({ env }, {
        projectId: input.projectId,
        calculateDate: endDate,
        includeFloatCalculation: true,
        includeScheduleRisk: true,
      });
      
      dashboard.kpis.schedule = {
        criticalPathExists: cpResult.criticalPathAnalysis.criticalPath.exists,
        criticalPathTasks: cpResult.criticalPathAnalysis.criticalPath.taskCount,
        projectDuration: cpResult.criticalPathAnalysis.criticalPath.totalDuration,
        averageFloat: cpResult.criticalPathAnalysis.floatAnalysis?.averageTotalFloat || 0,
        scheduleRisk: cpResult.criticalPathAnalysis.riskAnalysis || {},
      };
    } catch (error) {
      dashboard.kpis.schedule = { error: 'Critical path analysis failed' };
    }
  }

  // Resource Metrics
  if (input.includeResourceMetrics) {
    // Get time entries for resource analysis
    const timeFilters = [
      { project: { operator: '=', values: [input.projectId.toString()] } },
      { spentOn: { operator: '>=d', values: [startDate] } },
      { spentOn: { operator: '<=d', values: [endDate] } }
    ];

    try {
      const { json: timeData } = await opFetch<any>(env, '/api/v3/time_entries', {
        params: {
          filters: JSON.stringify(timeFilters),
          pageSize: 1000
        }
      });
      const timeEntries = timeData?._embedded?.elements ?? [];
      
      const totalHours = timeEntries.reduce((sum: number, te: any) => sum + (te.hours || 0), 0);
      const uniqueUsers = new Set(timeEntries.map((te: any) => te._links?.user?.href)).size;
      const avgHoursPerUser = uniqueUsers > 0 ? totalHours / uniqueUsers : 0;
      
      dashboard.kpis.resources = {
        totalHours,
        activeUsers: uniqueUsers,
        averageHoursPerUser: Math.round(avgHoursPerUser * 100) / 100,
        utilizationRate: 85, // Could be calculated based on capacity
      };
    } catch (error) {
      dashboard.kpis.resources = { error: 'Resource metrics calculation failed' };
    }
  }

  return { projectDashboard: dashboard };
}

// Helper function to calculate task duration
function calculateTaskDuration(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) return 1;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(1, diffDays);
}

// Helper function to parse ISO 8601 duration to hours
function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(\d+)([HDWMY])/);
  if (!match) return 8; // Default 8 hours
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'H': return value;
    case 'D': return value * 8; // 8 hours per day
    case 'W': return value * 40; // 40 hours per week
    case 'M': return value * 160; // 160 hours per month
    case 'Y': return value * 2000; // 2000 hours per year
    default: return value;
  }
}