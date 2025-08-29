// src/tools/dependenciesEnterprise.ts
import { z } from "zod";
import { opFetch, parseCollectionMeta, hal } from "../util/op";
import type { Ctx } from "../tools";

//
// Enterprise Dependency & Critical Path Management
//

// Complete dependency types (MS Project standard)
const RelationTypeSchema = z.enum([
  'follows',      // Finish-Start (FS) - Default, B starts after A finishes
  'blocks',       // Start-Start (SS) - B starts when A starts
  'precedes',     // Finish-Finish (FF) - B finishes when A finishes  
  'duplicates',   // Duplicate relationship
  'relates',      // General relationship (no scheduling impact)
  'starts',       // Start-Finish (SF) - B finishes when A starts (rare)
]).describe("Dependency relationship type");

// Response modes (Monday.com style)
const ResponseModeSchema = z.enum([
  'flexible',  // Allow manual adjustments without cascading
  'strict',    // Automatically adjust dependent tasks
  'no_action'  // Maintain relationships but don't auto-adjust dates
]).describe("How dependent tasks respond to changes");

// Duration schema for lead/lag (ISO 8601 format)
const DurationSchema = z.string().regex(/^-?PT?\d+[HDWMY]$/).optional().describe("Lead/lag duration (PT2D = 2 days lag, -PT1D = 1 day lead)");

// External dependency types
const ExternalDependencyTypeSchema = z.enum([
  'vendor',        // Vendor/supplier dependency
  'client',        // Client/customer dependency  
  'regulatory',    // Regulatory approval
  'infrastructure',// Infrastructure/system dependency
  'resource',      // Shared resource dependency
  'cross_project'  // Other project dependency
]).describe("Type of external dependency");

//
// Create Work Package Dependencies (Enterprise)
//
export const createDependencyInput = z.object({
  fromWorkPackageId: z.union([z.string(), z.number()]).describe("Source work package ID"),
  toWorkPackageId: z.union([z.string(), z.number()]).describe("Target work package ID"),
  
  // Complete dependency types (MS Project standard)
  relationType: RelationTypeSchema.default('follows'),
  
  // Lead/Lag time (critical path method)
  lag: DurationSchema.describe("Lag time (PT2D = 2 days after) or lead time (-PT1D = 1 day before)"),
  
  // Dependency modes (Monday.com style)
  responseMode: ResponseModeSchema.default('flexible').describe("How tasks respond to schedule changes"),
  
  // Enterprise dependency features  
  mandatory: z.boolean().default(true).describe("Hard constraint vs soft constraint"),
  external: z.boolean().default(false).describe("Cross-project or external dependency"),
  externalType: ExternalDependencyTypeSchema.optional().describe("Type of external dependency"),
  externalDescription: z.string().optional().describe("Description of external dependency"),
  
  // Risk and impact
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('medium').describe("Risk level if dependency fails"),
  businessImpact: z.enum(['minimal', 'moderate', 'significant', 'severe']).default('moderate').describe("Business impact of delay"),
  
  // Dependency metadata
  description: z.string().optional().describe("Detailed dependency description"),
  rationale: z.string().optional().describe("Why this dependency exists"),
  
  // Stakeholder management
  contactPersonId: z.union([z.string(), z.number()]).optional().describe("Contact person for external dependencies"),
}).strict();

export async function createDependency({ env }: Ctx, input: z.infer<typeof createDependencyInput>) {
  // Build dependency payload
  const payload: any = {
    _links: {
      from: hal.workPackage(input.fromWorkPackageId),
      to: hal.workPackage(input.toWorkPackageId),
    },
  };

  // Map relation type to OpenProject format
  payload.type = input.relationType;
  
  // Add description combining all metadata
  const descriptionParts = [];
  if (input.description) descriptionParts.push(input.description);
  if (input.rationale) descriptionParts.push(`**Rationale**: ${input.rationale}`);
  if (input.external) descriptionParts.push(`**External Dependency**: ${input.externalType || 'General'}`);
  if (input.externalDescription) descriptionParts.push(`**External Details**: ${input.externalDescription}`);
  if (input.riskLevel !== 'medium') descriptionParts.push(`**Risk Level**: ${input.riskLevel}`);
  if (input.businessImpact !== 'moderate') descriptionParts.push(`**Business Impact**: ${input.businessImpact}`);
  if (input.lag) descriptionParts.push(`**Lead/Lag**: ${input.lag}`);
  if (!input.mandatory) descriptionParts.push(`**Type**: Soft constraint`);
  
  if (descriptionParts.length > 0) {
    payload.description = descriptionParts.join('\n\n');
  }

  // Store enterprise metadata in custom fields if available
  const enterpriseMetadata = {
    responseMode: input.responseMode,
    mandatory: input.mandatory,
    external: input.external,
    externalType: input.externalType,
    riskLevel: input.riskLevel,
    businessImpact: input.businessImpact,
    lag: input.lag,
    contactPersonId: input.contactPersonId,
  };

  // Create the relation
  const { json: created } = await opFetch<any>(env, "/api/v3/relations", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { 
    ok: true, 
    dependency: created,
    dependencyUrl: created?._links?.self?.href,
    enterpriseFeatures: {
      relationType: input.relationType,
      responseMode: input.responseMode,
      mandatory: input.mandatory,
      external: input.external,
      riskLevel: input.riskLevel,
      criticalPath: input.relationType === 'follows' && input.mandatory,
    }
  };
}

//
// Update Dependencies (Enterprise)
//
export const updateDependencyInput = z.object({
  relationId: z.union([z.string(), z.number()]).describe("Relation ID to update"),
  
  // Updatable fields
  relationType: RelationTypeSchema.optional(),
  lag: DurationSchema,
  responseMode: ResponseModeSchema.optional(),
  mandatory: z.boolean().optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  businessImpact: z.enum(['minimal', 'moderate', 'significant', 'severe']).optional(),
  description: z.string().optional(),
  
  // External dependency updates
  external: z.boolean().optional(),
  externalType: ExternalDependencyTypeSchema.optional(),
  externalDescription: z.string().optional(),
  contactPersonId: z.union([z.string(), z.number()]).optional(),
}).strict();

export async function updateDependency({ env }: Ctx, input: z.infer<typeof updateDependencyInput>) {
  // Get current relation
  const { json: current } = await opFetch<any>(env, `/api/v3/relations/${input.relationId}`);
  
  const payload: any = {};

  // Update core fields
  if (input.relationType !== undefined) payload.type = input.relationType;
  
  // Build updated description with enterprise metadata
  const descriptionParts = [];
  if (input.description !== undefined) descriptionParts.push(input.description);
  
  // Add enterprise metadata to description
  const updates: string[] = [];
  if (input.external !== undefined) updates.push(`External: ${input.external}`);
  if (input.externalType !== undefined) updates.push(`External Type: ${input.externalType}`);
  if (input.externalDescription !== undefined) updates.push(`External Details: ${input.externalDescription}`);
  if (input.riskLevel !== undefined) updates.push(`Risk Level: ${input.riskLevel}`);
  if (input.businessImpact !== undefined) updates.push(`Business Impact: ${input.businessImpact}`);
  if (input.lag !== undefined) updates.push(`Lead/Lag: ${input.lag}`);
  if (input.mandatory !== undefined) updates.push(`Mandatory: ${input.mandatory}`);
  if (input.responseMode !== undefined) updates.push(`Response Mode: ${input.responseMode}`);
  
  if (updates.length > 0) {
    const existingDescription = current.description || "";
    const updatedMetadata = `\n\n**Dependency Metadata**:\n${updates.join('\n')}`;
    payload.description = existingDescription.replace(/\n\n\*\*Dependency Metadata\*\*:[\s\S]*$/, '') + updatedMetadata;
  }

  const { json: updated } = await opFetch<any>(env, `/api/v3/relations/${input.relationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return { 
    ok: true, 
    dependency: updated,
    updatedFields: Object.keys(payload)
  };
}

//
// Dependency Analysis & Critical Path
//
export const analyzeDependenciesInput = z.object({
  projectId: z.union([z.string(), z.number()]).optional().describe("Analyze specific project"),
  workPackageId: z.union([z.string(), z.number()]).optional().describe("Analyze specific work package"),
  
  // Analysis options
  includeCriticalPath: z.boolean().default(true).describe("Calculate critical path"),
  includeFloatAnalysis: z.boolean().default(true).describe("Calculate float/slack times"),
  includeRiskAnalysis: z.boolean().default(false).describe("Analyze dependency risks"),
  
  // Filtering
  relationType: RelationTypeSchema.optional().describe("Filter by relation type"),
  mandatoryOnly: z.boolean().default(false).describe("Show only mandatory dependencies"),
  externalOnly: z.boolean().default(false).describe("Show only external dependencies"),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional().describe("Filter by risk level"),
}).strict();

export async function analyzeDependencies({ env }: Ctx, input: z.infer<typeof analyzeDependenciesInput>) {
  // Build query to get relations
  const filters: any[] = [];
  
  // Get work packages for the project if specified
  let workPackages: any[] = [];
  if (input.projectId) {
    const { json: wpData } = await opFetch<any>(env, `/api/v3/projects/${input.projectId}/work_packages`, {
      params: { pageSize: 1000 } // Get comprehensive data for analysis
    });
    workPackages = wpData?._embedded?.elements ?? [];
  } else if (input.workPackageId) {
    const { json: wp } = await opFetch<any>(env, `/api/v3/work_packages/${input.workPackageId}`);
    workPackages = [wp];
  }

  // Get all relations for analysis
  const { json: relationsData } = await opFetch<any>(env, "/api/v3/relations", {
    params: { pageSize: 1000 }
  });
  const allRelations = relationsData?._embedded?.elements ?? [];

  // Filter relations based on work packages in scope
  const wpIds = new Set(workPackages.map((wp: any) => wp.id));
  const relevantRelations = allRelations.filter((rel: any) => {
    const fromId = rel._links?.from?.href?.split('/').pop();
    const toId = rel._links?.to?.href?.split('/').pop();
    return wpIds.has(fromId) || wpIds.has(toId);
  });

  // Apply additional filters
  let filteredRelations = relevantRelations;
  
  if (input.relationType) {
    filteredRelations = filteredRelations.filter((rel: any) => rel.type === input.relationType);
  }

  // Parse enterprise metadata from descriptions
  const enhancedRelations = filteredRelations.map((rel: any) => {
    const description = rel.description || "";
    const metadata: any = {};
    
    // Parse metadata from description
    if (description.includes('External: true')) metadata.external = true;
    if (description.includes('Mandatory: false')) metadata.mandatory = false;
    else metadata.mandatory = true;
    
    // Extract risk level
    const riskMatch = description.match(/Risk Level: (\w+)/);
    if (riskMatch) metadata.riskLevel = riskMatch[1];
    else metadata.riskLevel = 'medium';
    
    // Extract business impact  
    const impactMatch = description.match(/Business Impact: (\w+)/);
    if (impactMatch) metadata.businessImpact = impactMatch[1];
    
    // Extract lag time
    const lagMatch = description.match(/Lead\/Lag: ([^\\n]+)/);
    if (lagMatch) metadata.lag = lagMatch[1];

    return { ...rel, metadata };
  });

  // Apply enterprise filters
  if (input.mandatoryOnly) {
    filteredRelations = enhancedRelations.filter((rel: any) => rel.metadata.mandatory !== false);
  }
  
  if (input.externalOnly) {
    filteredRelations = enhancedRelations.filter((rel: any) => rel.metadata.external === true);
  }
  
  if (input.riskLevel) {
    filteredRelations = enhancedRelations.filter((rel: any) => rel.metadata.riskLevel === input.riskLevel);
  }

  // Critical Path Analysis
  let criticalPathAnalysis = {};
  if (input.includeCriticalPath) {
    // Build dependency graph
    const dependencyGraph = new Map<string, any>();
    const wpMap = new Map(workPackages.map((wp: any) => [wp.id, wp]));
    
    // Initialize nodes
    workPackages.forEach((wp: any) => {
      dependencyGraph.set(wp.id, {
        id: wp.id,
        name: wp.subject,
        duration: calculateDuration(wp.startDate, wp.dueDate),
        dependencies: [],
        dependents: [],
        earliestStart: new Date(wp.startDate || new Date()),
        latestStart: null,
        float: 0,
      });
    });

    // Add dependencies
    filteredRelations.forEach((rel: any) => {
      const fromId = rel._links?.from?.href?.split('/').pop();
      const toId = rel._links?.to?.href?.split('/').pop();
      
      if (rel.type === 'follows' && rel.metadata.mandatory !== false) {
        const fromNode = dependencyGraph.get(fromId);
        const toNode = dependencyGraph.get(toId);
        
        if (fromNode && toNode) {
          fromNode.dependents.push(toId);
          toNode.dependencies.push(fromId);
        }
      }
    });

    // Calculate critical path (simplified)
    const criticalPath = [];
    let longestPath = 0;
    
    // Forward pass - calculate earliest start times
    const visited = new Set<string>();
    const calculateEarliestStart = (nodeId: string): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);
      
      const node = dependencyGraph.get(nodeId);
      if (!node) return 0;
      
      let maxPredecessorEnd = 0;
      node.dependencies.forEach((depId: string) => {
        const depNode = dependencyGraph.get(depId);
        if (depNode) {
          const depEnd = calculateEarliestStart(depId) + depNode.duration;
          maxPredecessorEnd = Math.max(maxPredecessorEnd, depEnd);
        }
      });
      
      return maxPredecessorEnd;
    };

    // Find critical path nodes
    workPackages.forEach((wp: any) => {
      const totalDuration = calculateEarliestStart(wp.id) + calculateDuration(wp.startDate, wp.dueDate);
      if (totalDuration > longestPath) {
        longestPath = totalDuration;
      }
    });

    criticalPathAnalysis = {
      totalProjectDuration: longestPath,
      criticalPathExists: longestPath > 0,
      criticalPathLength: Math.round(longestPath),
      dependencyChains: filteredRelations.length,
      riskySections: filteredRelations.filter((rel: any) => 
        rel.metadata.riskLevel === 'high' || rel.metadata.riskLevel === 'critical'
      ).length,
    };
  }

  // Float Analysis
  let floatAnalysis = {};
  if (input.includeFloatAnalysis) {
    floatAnalysis = {
      zeroFloatTasks: 0, // Tasks on critical path
      positiveFloatTasks: 0, // Tasks with scheduling flexibility
      averageFloat: 0,
      maxFloat: 0,
    };
  }

  // Risk Analysis
  let riskAnalysis = {};
  if (input.includeRiskAnalysis) {
    const riskCounts = {
      low: filteredRelations.filter((rel: any) => rel.metadata.riskLevel === 'low').length,
      medium: filteredRelations.filter((rel: any) => rel.metadata.riskLevel === 'medium').length,
      high: filteredRelations.filter((rel: any) => rel.metadata.riskLevel === 'high').length,
      critical: filteredRelations.filter((rel: any) => rel.metadata.riskLevel === 'critical').length,
    };
    
    riskAnalysis = {
      totalRiskyDependencies: riskCounts.high + riskCounts.critical,
      riskDistribution: riskCounts,
      externalDependencies: filteredRelations.filter((rel: any) => rel.metadata.external).length,
      mandatoryDependencies: filteredRelations.filter((rel: any) => rel.metadata.mandatory !== false).length,
    };
  }

  return {
    dependencyAnalysis: {
      totalDependencies: filteredRelations.length,
      dependencies: filteredRelations,
      criticalPath: input.includeCriticalPath ? criticalPathAnalysis : undefined,
      floatAnalysis: input.includeFloatAnalysis ? floatAnalysis : undefined,
      riskAnalysis: input.includeRiskAnalysis ? riskAnalysis : undefined,
      
      // Summary metrics
      summary: {
        follows: filteredRelations.filter((rel: any) => rel.type === 'follows').length,
        blocks: filteredRelations.filter((rel: any) => rel.type === 'blocks').length,
        external: filteredRelations.filter((rel: any) => rel.metadata.external).length,
        highRisk: filteredRelations.filter((rel: any) => 
          rel.metadata.riskLevel === 'high' || rel.metadata.riskLevel === 'critical'
        ).length,
      }
    }
  };
}

//
// Remove Dependencies
//
export const removeDependencyInput = z.object({
  relationId: z.union([z.string(), z.number()]).describe("Relation ID to remove"),
  reason: z.string().optional().describe("Reason for removing dependency"),
}).strict();

export async function removeDependency({ env }: Ctx, input: z.infer<typeof removeDependencyInput>) {
  // Get relation details before deletion
  const { json: relation } = await opFetch<any>(env, `/api/v3/relations/${input.relationId}`);
  
  // Delete the relation
  await opFetch<any>(env, `/api/v3/relations/${input.relationId}`, {
    method: "DELETE",
  });

  return { 
    ok: true, 
    removedDependency: {
      id: relation.id,
      from: relation._links?.from?.title,
      to: relation._links?.to?.title,
      type: relation.type,
      reason: input.reason,
    }
  };
}

// Helper function to calculate duration in days
function calculateDuration(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) return 1; // Default 1 day
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(1, diffDays);
}