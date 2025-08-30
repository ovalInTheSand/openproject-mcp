// src/tools/milestonesEnterprise.ts
import { z } from "zod";
import { opFetch, parseCollectionMeta, hal } from "../util/op";
import type { Ctx } from "../tools";

//
// Enterprise Milestone & Phase Gate Management
//

// Formattable field schema
const FormattableFieldSchema = z.object({
  format: z.string().default("markdown"),
  raw: z.string(),
  html: z.string().optional(),
}).optional();

// Enterprise milestone custom fields
const MilestoneCustomFieldsSchema = z.object({
  customField1: z.any().optional(), // Gate criteria
  customField2: z.any().optional(), // Approval required
  customField3: z.any().optional(), // Stakeholder sign-off
  customField4: z.any().optional(), // Budget checkpoint
  customField5: z.any().optional(), // Risk assessment
  customField6: z.any().optional(), // Quality metrics
  customField7: z.any().optional(), // Compliance check
  customField8: z.any().optional(), // Business value delivered
}).partial();

// Milestone status enum
const MilestoneStatusSchema = z.enum(['open', 'locked', 'closed']).describe("Milestone status");

// Sharing/visibility enum
const SharingSchema = z.enum([
  'none',        // Not shared
  'descendants', // Shared with child projects
  'hierarchy',   // Shared with project hierarchy
  'tree',        // Shared with project tree
  'system'       // System-wide sharing
]).describe("Milestone sharing level");

// Enterprise milestone types
const MilestoneTypeSchema = z.enum([
  'phase_gate',     // Phase gate requiring approval
  'deliverable',    // Deliverable milestone
  'review_point',   // Review/checkpoint milestone
  'baseline',       // Baseline establishment point
  'release',        // Release milestone
  'decision_point', // Decision gate
  'risk_checkpoint' // Risk assessment point
]).describe("Type of milestone for enterprise governance");

//
// Enhanced Version/Milestone Creation (Enterprise)
//
export const createMilestoneEnterpriseInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID"),
  
  // Core milestone fields
  name: z.string().min(1).max(60).describe("Milestone name (1-60 characters)"),
  description: FormattableFieldSchema.describe("Detailed milestone description"),
  
  // Timeline management (enterprise)
  startDate: z.string().optional().describe("Milestone start date (YYYY-MM-DD)"),
  endDate: z.string().optional().describe("Target completion date (YYYY-MM-DD)"),
  baselineDate: z.string().optional().describe("Original baseline date for EVM"),
  
  // Status and visibility
  status: MilestoneStatusSchema.default('open'),
  sharing: SharingSchema.default('descendants'),
  
  // Enterprise milestone features
  milestoneType: MilestoneTypeSchema.default('deliverable').describe("Enterprise milestone classification"),
  criticalPath: z.boolean().default(false).describe("Whether milestone is on critical path"),
  
  // Phase gate management
  approvalRequired: z.boolean().default(false).describe("Requires stakeholder approval to close"),
  approverIds: z.array(z.union([z.string(), z.number()])).optional().describe("Required approver user IDs"),
  gateExitCriteria: z.string().optional().describe("Criteria that must be met to pass gate"),
  
  // Stakeholder management
  responsibleId: z.union([z.string(), z.number()]).optional().describe("Milestone owner/responsible person"),
  stakeholderIds: z.array(z.union([z.string(), z.number()])).optional().describe("Key stakeholder IDs"),
  
  // Quality and compliance
  qualityGateRequired: z.boolean().default(false).describe("Requires quality gate approval"),
  complianceCheckRequired: z.boolean().default(false).describe("Requires compliance verification"),
  
  // Custom enterprise fields
  customFields: MilestoneCustomFieldsSchema.optional().describe("Organization-specific milestone fields"),
}).strict();

export async function createMilestoneEnterprise({ env }: Ctx, input: z.infer<typeof createMilestoneEnterpriseInput>) {
  // Build comprehensive milestone payload
  const payload: any = {
    name: input.name,
    status: input.status,
    sharing: input.sharing,
    _links: {},
  };

  // Add optional core fields
  if (input.description) {payload.description = input.description;}
  if (input.startDate) {payload.startDate = input.startDate;}
  if (input.endDate) {payload.endDate = input.endDate;}

  // Enterprise milestone metadata
  const enterpriseMetadata = {
    milestoneType: input.milestoneType,
    criticalPath: input.criticalPath,
    approvalRequired: input.approvalRequired,
    gateExitCriteria: input.gateExitCriteria,
    qualityGateRequired: input.qualityGateRequired,
    complianceCheckRequired: input.complianceCheckRequired,
    baselineDate: input.baselineDate,
  };

  // Store enterprise metadata in custom fields
  if (input.customFields) {
    Object.entries(input.customFields).forEach(([key, value]: [string, any]) => {
      if (value !== undefined) {
        payload[key] = value;
      }
    });
  }

  // Store enterprise metadata in available custom fields
  payload.customField1 = JSON.stringify(enterpriseMetadata);

  // Stakeholder assignments
  if (input.responsibleId) {payload._links.responsible = hal.user(input.responsibleId);}
  
  // Store approvers and stakeholders in description if no dedicated fields
  if (input.approverIds || input.stakeholderIds) {
    const stakeholderInfo = [];
    if (input.approverIds?.length) {
      stakeholderInfo.push(`**Approvers**: ${input.approverIds.join(', ')}`);
    }
    if (input.stakeholderIds?.length) {
      stakeholderInfo.push(`**Key Stakeholders**: ${input.stakeholderIds.join(', ')}`);
    }
    
    const originalDescription = input.description?.raw || "";
    payload.description = {
      format: "markdown",
      raw: originalDescription + (originalDescription ? "\n\n" : "") + stakeholderInfo.join("\n\n")
    };
  }

  const { json: created } = await opFetch<any>(env, "/api/v3/versions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { 
    ok: true, 
    milestone: created,
    milestoneUrl: created?._links?.self?.href,
    enterpriseFeatures: {
      type: input.milestoneType,
      criticalPath: input.criticalPath,
      approvalRequired: input.approvalRequired,
      phaseGate: input.milestoneType === 'phase_gate',
    }
  };
}

//
// Enterprise Milestone Updates
//
export const updateMilestoneEnterpriseInput = z.object({
  id: z.union([z.string(), z.number()]).describe("Milestone ID"),
  
  // Updatable fields
  name: z.string().min(1).max(60).optional(),
  description: FormattableFieldSchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: MilestoneStatusSchema.optional(),
  sharing: SharingSchema.optional(),
  
  // Enterprise updates
  milestoneType: MilestoneTypeSchema.optional(),
  criticalPath: z.boolean().optional(),
  approvalRequired: z.boolean().optional(),
  gateExitCriteria: z.string().optional(),
  qualityGateRequired: z.boolean().optional(),
  complianceCheckRequired: z.boolean().optional(),
  
  // Stakeholder updates
  responsibleId: z.union([z.string(), z.number()]).optional(),
  approverIds: z.array(z.union([z.string(), z.number()])).optional(),
  stakeholderIds: z.array(z.union([z.string(), z.number()])).optional(),
  
  // Custom field updates
  customFields: MilestoneCustomFieldsSchema.optional(),
}).strict();

export async function updateMilestoneEnterprise({ env }: Ctx, input: z.infer<typeof updateMilestoneEnterpriseInput>) {
  // Get current milestone data
  const { json: current } = await opFetch<any>(env, `/api/v3/versions/${input.id}`);
  
  const payload: any = {};

  // Update core fields
  if (input.name !== undefined) {payload.name = input.name;}
  if (input.description !== undefined) {payload.description = input.description;}
  if (input.startDate !== undefined) {payload.startDate = input.startDate;}
  if (input.endDate !== undefined) {payload.endDate = input.endDate;}
  if (input.status !== undefined) {payload.status = input.status;}
  if (input.sharing !== undefined) {payload.sharing = input.sharing;}

  // Update enterprise metadata
  let enterpriseMetadata: any = {};
  try {
    enterpriseMetadata = JSON.parse(current.customField1 || '{}');
  } catch (e) {
    enterpriseMetadata = {};
  }

  // Update enterprise fields
  if (input.milestoneType !== undefined) {enterpriseMetadata.milestoneType = input.milestoneType;}
  if (input.criticalPath !== undefined) {enterpriseMetadata.criticalPath = input.criticalPath;}
  if (input.approvalRequired !== undefined) {enterpriseMetadata.approvalRequired = input.approvalRequired;}
  if (input.gateExitCriteria !== undefined) {enterpriseMetadata.gateExitCriteria = input.gateExitCriteria;}
  if (input.qualityGateRequired !== undefined) {enterpriseMetadata.qualityGateRequired = input.qualityGateRequired;}
  if (input.complianceCheckRequired !== undefined) {enterpriseMetadata.complianceCheckRequired = input.complianceCheckRequired;}

  payload.customField1 = JSON.stringify(enterpriseMetadata);

  // Update stakeholder assignments
  payload._links = {};
  if (input.responsibleId !== undefined) {
    payload._links.responsible = input.responsibleId ? hal.user(input.responsibleId) : null;
  }

  // Update custom fields
  if (input.customFields) {
    Object.entries(input.customFields).forEach(([key, value]: [string, any]) => {
      if (value !== undefined) {
        payload[key] = value;
      }
    });
  }

  const { json: updated } = await opFetch<any>(env, `/api/v3/versions/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return { 
    ok: true, 
    milestone: updated,
    enterpriseMetadata: enterpriseMetadata
  };
}

//
// Phase Gate Approval Process
//
export const processPhaseGateInput = z.object({
  milestoneId: z.union([z.string(), z.number()]).describe("Milestone ID"),
  action: z.enum(['approve', 'reject', 'request_review']).describe("Gate action"),
  approverId: z.union([z.string(), z.number()]).describe("Approver user ID"),
  comments: z.string().optional().describe("Approval/rejection comments"),
  exitCriteriaMet: z.boolean().optional().describe("Whether all exit criteria are satisfied"),
  conditionalApproval: z.boolean().default(false).describe("Approval with conditions"),
  conditions: z.string().optional().describe("Conditions for conditional approval"),
}).strict();

export async function processPhaseGate({ env }: Ctx, input: z.infer<typeof processPhaseGateInput>) {
  // Get current milestone
  const { json: milestone } = await opFetch<any>(env, `/api/v3/versions/${input.milestoneId}`);
  
  // Get enterprise metadata
  let enterpriseMetadata: any = {};
  try {
    enterpriseMetadata = JSON.parse(milestone.customField1 || '{}');
  } catch (e) {
    enterpriseMetadata = {};
  }

  // Validate this is a phase gate
  if (enterpriseMetadata.milestoneType !== 'phase_gate') {
    throw new Error("Milestone is not configured as a phase gate");
  }

  // Process the gate action
  const approvalRecord = {
    approverId: input.approverId,
    action: input.action,
    timestamp: new Date().toISOString(),
    comments: input.comments,
    exitCriteriaMet: input.exitCriteriaMet,
    conditionalApproval: input.conditionalApproval,
    conditions: input.conditions,
  };

  // Update milestone status based on action
  let newStatus = milestone.status;
  let statusDescription = "";

  switch (input.action) {
    case 'approve':
      if (input.conditionalApproval) {
        newStatus = 'locked'; // Conditionally approved
        statusDescription = `Phase gate conditionally approved by ${input.approverId}. Conditions: ${input.conditions}`;
      } else {
        newStatus = 'closed'; // Fully approved
        statusDescription = `Phase gate approved by ${input.approverId}`;
      }
      break;
    
    case 'reject':
      newStatus = 'open'; // Keep open for rework
      statusDescription = `Phase gate rejected by ${input.approverId}. Comments: ${input.comments}`;
      break;
      
    case 'request_review':
      newStatus = 'locked'; // Lock for review
      statusDescription = `Phase gate review requested by ${input.approverId}`;
      break;
  }

  // Store approval record
  if (!enterpriseMetadata.approvalHistory) {
    enterpriseMetadata.approvalHistory = [];
  }
  enterpriseMetadata.approvalHistory.push(approvalRecord);
  enterpriseMetadata.lastApprovalAction = approvalRecord;

  // Update milestone
  const updatePayload: any = {
    status: newStatus,
    customField1: JSON.stringify(enterpriseMetadata),
  };

  // Add status description if supported
  if (milestone.description) {
    const existingDescription = milestone.description.raw || "";
    updatePayload.description = {
      format: "markdown",
      raw: existingDescription + "\n\n---\n**" + new Date().toLocaleDateString() + "**: " + statusDescription
    };
  }

  const { json: updated } = await opFetch<any>(env, `/api/v3/versions/${input.milestoneId}`, {
    method: "PATCH",
    body: JSON.stringify(updatePayload),
  });

  return { 
    ok: true,
    milestone: updated,
    phaseGateResult: {
      action: input.action,
      approved: input.action === 'approve',
      conditional: input.conditionalApproval,
      newStatus: newStatus,
      approvalRecord: approvalRecord
    }
  };
}

//
// Milestone Progress & Analytics
//
export const getMilestoneProgressInput = z.object({
  projectId: z.union([z.string(), z.number()]).optional().describe("Filter by project"),
  milestoneType: MilestoneTypeSchema.optional().describe("Filter by milestone type"),
  status: MilestoneStatusSchema.optional().describe("Filter by status"),
  criticalPathOnly: z.boolean().default(false).describe("Show only critical path milestones"),
  includeAnalytics: z.boolean().default(true).describe("Include progress analytics"),
  
  // Date filtering
  dueDateFrom: z.string().optional().describe("Due date range start"),
  dueDateTo: z.string().optional().describe("Due date range end"),
  
  // Pagination
  offset: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(25),
}).strict();

export async function getMilestoneProgress({ env }: Ctx, input: z.infer<typeof getMilestoneProgressInput>) {
  const filters: any[] = [];
  
  // Basic filters
  if (input.status !== undefined) {
    filters.push({ status: { operator: "=", values: [input.status] } });
  }

  // Date range filters
  if (input.dueDateFrom) {
    filters.push({ endDate: { operator: ">=d", values: [input.dueDateFrom] } });
  }
  if (input.dueDateTo) {
    filters.push({ endDate: { operator: "<=d", values: [input.dueDateTo] } });
  }

  // Build API path
  const basePath = input.projectId ? `/api/v3/projects/${input.projectId}/versions` : "/api/v3/versions";
  
  const params: Record<string, unknown> = {
    offset: input.offset,
    pageSize: input.pageSize,
    sortBy: JSON.stringify([['endDate', 'asc'], ['name', 'asc']]),
  };
  
  if (filters.length > 0) {
    params.filters = JSON.stringify(filters);
  }

  const { json } = await opFetch<any>(env, basePath, { params });
  const meta = parseCollectionMeta(json);
  const elements = json?._embedded?.elements ?? [];
  
  // Filter and enhance with enterprise data
  const enhancedMilestones = elements
    .map((milestone: any) => {
      // Parse enterprise metadata
      let enterpriseData: any = {};
      try {
        enterpriseData = JSON.parse(milestone.customField1 || '{}');
      } catch (e) {
        enterpriseData = {};
      }

      return {
        ...milestone,
        enterpriseData,
        milestoneType: enterpriseData.milestoneType || 'deliverable',
        criticalPath: enterpriseData.criticalPath || false,
        approvalRequired: enterpriseData.approvalRequired || false,
        lastApprovalAction: enterpriseData.lastApprovalAction,
      };
    })
    .filter((milestone: any) => {
      // Apply enterprise filters
      if (input.milestoneType && milestone.milestoneType !== input.milestoneType) {return false;}
      if (input.criticalPathOnly && !milestone.criticalPath) {return false;}
      return true;
    });

  // Calculate analytics
  let analytics = {};
  if (input.includeAnalytics) {
    const today = new Date();
    analytics = {
      totalMilestones: enhancedMilestones.length,
      byStatus: {
        open: enhancedMilestones.filter((m: any) => m.status === 'open').length,
        locked: enhancedMilestones.filter((m: any) => m.status === 'locked').length,
        closed: enhancedMilestones.filter((m: any) => m.status === 'closed').length,
      },
      byType: {
        phase_gate: enhancedMilestones.filter((m: any) => m.milestoneType === 'phase_gate').length,
        deliverable: enhancedMilestones.filter((m: any) => m.milestoneType === 'deliverable').length,
        review_point: enhancedMilestones.filter((m: any) => m.milestoneType === 'review_point').length,
      },
      criticalPathCount: enhancedMilestones.filter((m: any) => m.criticalPath).length,
      overdueCount: enhancedMilestones.filter((m: any) => 
        m.endDate && new Date(m.endDate) < today && m.status !== 'closed'
      ).length,
      approvalsPendingCount: enhancedMilestones.filter((m: any) => 
        m.approvalRequired && m.status !== 'closed'
      ).length,
    };
  }

  return { 
    milestones: enhancedMilestones,
    analytics: input.includeAnalytics ? analytics : undefined,
    ...meta,
    appliedFilters: filters.length > 0 ? filters : undefined 
  };
}