// src/tools/hybridTools.ts
import { z } from "zod";
import { hybridManager } from "../data/hybrid-manager";
import { variableManager } from "../data/variable-manager";
import { cacheManager } from "../data/cache-manager";
import type { Ctx } from "../tools";
import { PMOVariablesSchema } from "../types/hybrid-data";

/**
 * New MCP tools for hybrid PMO functionality
 * These tools provide access to the hybrid data system that combines
 * OpenProject native calculations with custom enterprise features
 */

//
// Project Data Tools - Hybrid approach
//
export const getProjectDataInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID"),
  includeCalculations: z.boolean().default(true).describe("Include enterprise calculations (EVM, Critical Path, etc.)"),
  forceRefresh: z.boolean().default(false).describe("Force refresh of cached data"),
}).strict();

export async function getProjectData(ctx: Ctx, input: z.infer<typeof getProjectDataInput>) {
  if (input.forceRefresh) {
    await hybridManager.invalidateProjectCache(input.projectId);
  }
  
  return await hybridManager.getProjectData(ctx, input.projectId);
}

//
// Real-time Project Status (Never cached)
//
export const getProjectStatusInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID"),
}).strict();

export async function getProjectStatus(ctx: Ctx, input: z.infer<typeof getProjectStatusInput>) {
  return await hybridManager.getProjectStatus(ctx, input.projectId);
}

//
// Portfolio Analytics
//
export const getPortfolioAnalyticsInput = z.object({
  projectIds: z.array(z.union([z.string(), z.number()])).describe("Array of project IDs to analyze"),
  includeResourceConflicts: z.boolean().default(true).describe("Include resource conflict analysis"),
  includeRecommendations: z.boolean().default(true).describe("Include strategic recommendations"),
}).strict();

export async function getPortfolioAnalytics(ctx: Ctx, input: z.infer<typeof getPortfolioAnalyticsInput>) {
  return await hybridManager.getPortfolioAnalytics(ctx, input.projectIds);
}

//
// PMO Variable Management Tools
//
export const getProjectVariablesInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID"),
}).strict();

export async function getProjectVariables(ctx: Ctx, input: z.infer<typeof getProjectVariablesInput>) {
  return await variableManager.getProjectVariables(ctx, input.projectId);
}

export const setProjectVariablesInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID"),
  variables: PMOVariablesSchema.partial().describe("PMO variables to update"),
  validateOnly: z.boolean().default(false).describe("Only validate changes without applying them"),
}).strict();

export async function setProjectVariables(ctx: Ctx, input: z.infer<typeof setProjectVariablesInput>) {
  // Validate the changes first
  const validation = await variableManager.validateVariableChanges(ctx, input.projectId, input.variables);
  
  if (!validation.isValid) {
    return {
      success: false,
      validation,
      message: "Variable changes failed validation"
    };
  }
  
  if (input.validateOnly) {
    return {
      success: true,
      validation,
      message: "Variables validated successfully",
      wouldApply: input.variables
    };
  }
  
  // Apply the changes
  const updatedVariables = await variableManager.setProjectVariables(ctx, input.projectId, input.variables);
  
  // Invalidate cache since variables changed
  await hybridManager.invalidateProjectCache(input.projectId);
  
  return {
    success: true,
    validation,
    updatedVariables,
    message: "Variables updated successfully"
  };
}

export const getOrganizationalDefaultsInput = z.object({}).strict();

export async function getOrganizationalDefaults(ctx: Ctx, input: z.infer<typeof getOrganizationalDefaultsInput>) {
  return await variableManager.getOrganizationalDefaults(ctx);
}

export const setOrganizationalDefaultsInput = z.object({
  defaults: PMOVariablesSchema.partial().describe("Organizational default PMO variables"),
}).strict();

export async function setOrganizationalDefaults(ctx: Ctx, input: z.infer<typeof setOrganizationalDefaultsInput>) {
  await variableManager.setOrganizationalDefaults(ctx, input.defaults);
  
  return {
    success: true,
    message: "Organizational defaults updated successfully"
  };
}

//
// User Variables
//
export const getUserVariablesInput = z.object({
  userId: z.union([z.string(), z.number()]).describe("User ID"),
}).strict();

export async function getUserVariables(ctx: Ctx, input: z.infer<typeof getUserVariablesInput>) {
  return await variableManager.getUserVariables(ctx, input.userId);
}

//
// Multiple Projects Data
//
export const getMultipleProjectsDataInput = z.object({
  projectIds: z.array(z.union([z.string(), z.number()])).describe("Array of project IDs"),
  includeCalculations: z.boolean().default(true).describe("Include enterprise calculations"),
}).strict();

export async function getMultipleProjectsData(ctx: Ctx, input: z.infer<typeof getMultipleProjectsDataInput>) {
  return await hybridManager.getMultipleProjectsData(ctx, input.projectIds);
}

//
// Cache Management Tools
//
export const getCachePerformanceInput = z.object({}).strict();

export async function getCachePerformance(ctx: Ctx, input: z.infer<typeof getCachePerformanceInput>) {
  return await hybridManager.getCachePerformance();
}

export const clearProjectCacheInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID to clear cache for"),
}).strict();

export async function clearProjectCache(ctx: Ctx, input: z.infer<typeof clearProjectCacheInput>) {
  await hybridManager.invalidateProjectCache(input.projectId);
  
  return {
    success: true,
    message: `Cache cleared for project ${input.projectId}`
  };
}

export const warmCacheInput = z.object({
  projectIds: z.array(z.union([z.string(), z.number()])).describe("Array of project IDs to warm cache for"),
}).strict();

export async function warmCache(ctx: Ctx, input: z.infer<typeof warmCacheInput>) {
  await cacheManager.warmCache(input.projectIds);
  
  return {
    success: true,
    message: `Cache warmed for ${input.projectIds.length} projects`
  };
}

//
// Variable Export/Import Tools
//
export const exportProjectVariablesInput = z.object({
  projectIds: z.array(z.union([z.string(), z.number()])).describe("Array of project IDs to export"),
}).strict();

export async function exportProjectVariables(ctx: Ctx, input: z.infer<typeof exportProjectVariablesInput>) {
  return await variableManager.exportProjectVariables(ctx, input.projectIds);
}

//
// Enhanced EVM Analysis (with variable comparison)
//
export const analyzeEVMWithBenchmarkInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID"),
  benchmarkProjects: z.array(z.union([z.string(), z.number()])).optional().describe("Project IDs to benchmark against"),
  includeIndustryComparison: z.boolean().default(false).describe("Include industry benchmark comparison"),
}).strict();

export async function analyzeEVMWithBenchmark(ctx: Ctx, input: z.infer<typeof analyzeEVMWithBenchmarkInput>) {
  const projectData = await hybridManager.getProjectData(ctx, input.projectId);
  
  if (!projectData.calculations?.evm) {
    throw new Error('EVM calculation not available for this project');
  }
  
  const result: any = {
    project: {
      id: input.projectId,
      name: projectData.native.name,
      evm: projectData.calculations.evm
    }
  };
  
  // Compare with benchmark projects if provided
  if (input.benchmarkProjects?.length) {
    const benchmarkData = await hybridManager.getMultipleProjectsData(ctx, input.benchmarkProjects);
    const benchmarkEVMs = benchmarkData
      .map(p => p.calculations?.evm)
      .filter(evm => evm !== undefined);
    
    if (benchmarkEVMs.length > 0) {
      const avgCPI = benchmarkEVMs.reduce((sum, evm) => sum + evm!.costPerformanceIndex, 0) / benchmarkEVMs.length;
      const avgSPI = benchmarkEVMs.reduce((sum, evm) => sum + evm!.schedulePerformanceIndex, 0) / benchmarkEVMs.length;
      
      result.benchmark = {
        averageCPI: Math.round(avgCPI * 1000) / 1000,
        averageSPI: Math.round(avgSPI * 1000) / 1000,
        projectCPIComparison: projectData.calculations.evm.costPerformanceIndex - avgCPI,
        projectSPIComparison: projectData.calculations.evm.schedulePerformanceIndex - avgSPI,
        projectRanking: {
          cpi: benchmarkEVMs.filter(evm => evm!.costPerformanceIndex < projectData.calculations!.evm!.costPerformanceIndex).length + 1,
          spi: benchmarkEVMs.filter(evm => evm!.schedulePerformanceIndex < projectData.calculations!.evm!.schedulePerformanceIndex).length + 1,
          total: benchmarkEVMs.length + 1
        }
      };
    }
  }
  
  // Industry comparison (placeholder - would be enhanced with real industry data)
  if (input.includeIndustryComparison) {
    const industryType = projectData.variables.industryType;
    const industryBenchmarks = getIndustryBenchmarks(industryType);
    
    result.industryComparison = {
      industryType,
      benchmarks: industryBenchmarks,
      projectPerformance: {
        cpiVsIndustry: projectData.calculations.evm.costPerformanceIndex - industryBenchmarks.averageCPI,
        spiVsIndustry: projectData.calculations.evm.schedulePerformanceIndex - industryBenchmarks.averageSPI
      }
    };
  }
  
  return result;
}

//
// System Health and Diagnostics
//
export const getSystemHealthInput = z.object({}).strict();

export async function getSystemHealth(ctx: Ctx, input: z.infer<typeof getSystemHealthInput>) {
  const cachePerformance = await hybridManager.getCachePerformance();
  
  return {
    timestamp: new Date().toISOString(),
    cache: cachePerformance,
    system: {
      status: 'healthy',
      version: '3.0.0',
      features: {
        hybridDataAccess: true,
        enterpriseCalculations: true,
        variableManagement: true,
        intelligentCaching: true
      }
    }
  };
}

// Helper function for industry benchmarks (would be enhanced with real data)
function getIndustryBenchmarks(industryType: string): { averageCPI: number; averageSPI: number } {
  const benchmarks: Record<string, { averageCPI: number; averageSPI: number }> = {
    'software': { averageCPI: 0.92, averageSPI: 0.88 },
    'construction': { averageCPI: 0.89, averageSPI: 0.85 },
    'manufacturing': { averageCPI: 0.94, averageSPI: 0.91 },
    'consulting': { averageCPI: 0.96, averageSPI: 0.93 },
    'default': { averageCPI: 0.91, averageSPI: 0.89 }
  };
  
  return benchmarks[industryType] || benchmarks['default'];
}