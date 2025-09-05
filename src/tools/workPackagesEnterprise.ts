// src/tools/workPackagesEnterprise.ts
import { z } from "zod";
import { opFetch, parseCollectionMeta, hal, withQuery } from "../util/op";
import type { Ctx } from "../tools";

//
// Enterprise Work Package Management - MS Project/PMBOK Level
//

// Duration schema (ISO 8601, relaxed: supports PT8H, P2D, P3DT4H30M, PT45M, PT3600S)
const DurationSchema = z.string()
  .regex(/^P(?=\d|T\d)(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/,
    'Invalid ISO 8601 duration (examples: PT8H, P2D, P3DT4H30M, PT45M)')
  .optional()
  .describe("ISO 8601 duration (PT8H, P2D, P3DT4H30M, PT45M)");

// Formattable field schema
const FormattableFieldSchema = z.object({
  format: z.string().default("markdown"),
  raw: z.string(),
  html: z.string().optional(),
}).optional();

// Enterprise custom fields (30+ supported)
const WorkPackageCustomFieldsSchema = z.object({
  customField1: z.any().optional(), // WBS code
  customField2: z.any().optional(), // Resource pool
  customField3: z.any().optional(), // Cost center
  customField4: z.any().optional(), // Risk level
  customField5: z.any().optional(), // Quality gate
  customField6: z.any().optional(), // Client billable
  customField7: z.any().optional(), // Department
  customField8: z.any().optional(), // Technology stack
  customField9: z.any().optional(), // Complexity rating
  customField10: z.any().optional(), // Business value
}).partial();

// Relation types for dependencies
const RelationTypeSchema = z.enum([
  'follows',      // Finish-Start (FS)
  'blocks',       // Start-Start (SS) 
  'precedes',     // Finish-Finish (FF)
  'duplicates',   // Duplicate relationship
  'relates'       // General relationship
]);

//
// Enterprise Work Package Creation with Full Scheduling
//
export const createWorkPackageEnterpriseInput = z.object({
  // Core required fields
  projectId: z.union([z.string(), z.number()]).describe("Project ID"),
  typeId: z.union([z.string(), z.number()]).describe("Work package type ID"),
  subject: z.string().min(1).max(255).describe("Work package subject/title"),
  
  // Complete scheduling schema (MS Project equivalent)
  description: FormattableFieldSchema.describe("Detailed description with markdown"),
  startDate: z.string().optional().describe("Planned start date (YYYY-MM-DD)"),
  dueDate: z.string().optional().describe("Planned due date (YYYY-MM-DD)"),
  estimatedTime: DurationSchema.describe("Estimated work effort (PT8H, PT2D)"),
  percentageDone: z.number().int().min(0).max(100).optional().describe("Completion percentage 0-100"),
  scheduleManually: z.boolean().default(false).describe("Manual vs automatic scheduling"),
  
  // Resource management (enterprise)
  assigneeId: z.union([z.string(), z.number()]).optional().describe("Primary assignee user ID"),
  responsibleId: z.union([z.string(), z.number()]).optional().describe("Responsible person (RACI)"),
  
  // Project structure
  parentId: z.union([z.string(), z.number()]).optional().describe("Parent work package (WBS hierarchy)"),
  versionId: z.union([z.string(), z.number()]).optional().describe("Target milestone/version"),
  
  // Status and priority
  statusId: z.union([z.string(), z.number()]).optional().describe("Work package status"),
  priorityId: z.union([z.string(), z.number()]).optional().describe("Priority level"),
  
  // Enterprise project management
  budgetId: z.union([z.string(), z.number()]).optional().describe("Associated budget"),
  categoryId: z.union([z.string(), z.number()]).optional().describe("Work category"),
  
  // Custom enterprise fields
  customFields: WorkPackageCustomFieldsSchema.optional().describe("Organization-specific fields"),
  
  // Notification and validation
  sendNotifications: z.boolean().default(true).describe("Send stakeholder notifications"),
  dryRun: z.boolean().default(false).describe("Validate only without creating"),
}).strict();

export async function createWorkPackageEnterprise({ env }: Ctx, input: z.infer<typeof createWorkPackageEnterpriseInput>) {
  // Build comprehensive work package payload
  const payload: any = {
    subject: input.subject,
    _links: {
      project: hal.project(input.projectId),
      type: hal.type(input.typeId),
    },
  };

  // Add scheduling fields
  if (input.description) {payload.description = input.description;}
  if (input.startDate) {payload.startDate = input.startDate;}
  if (input.dueDate) {payload.dueDate = input.dueDate;}
  if (input.estimatedTime) {payload.estimatedTime = input.estimatedTime;}
  if (input.percentageDone !== undefined) {payload.percentageDone = input.percentageDone;}
  if (input.scheduleManually !== undefined) {payload.scheduleManually = input.scheduleManually;}

  // Resource assignments
  if (input.assigneeId) {payload._links.assignee = hal.user(input.assigneeId);}
  if (input.responsibleId) {payload._links.responsible = hal.user(input.responsibleId);}

  // Project structure
  if (input.parentId) {payload._links.parent = hal.workPackage(input.parentId);}
  if (input.versionId) {payload._links.version = { href: `/api/v3/versions/${input.versionId}` };}

  // Status and priority
  if (input.statusId) {payload._links.status = hal.status(input.statusId);}
  if (input.priorityId) {payload._links.priority = hal.priority(input.priorityId);}

  // Enterprise fields
  if (input.budgetId) {payload._links.budget = { href: `/api/v3/budgets/${input.budgetId}` };}
  if (input.categoryId) {payload._links.category = { href: `/api/v3/categories/${input.categoryId}` };}

  // Custom fields
  if (input.customFields) {
    Object.entries(input.customFields).forEach(([key, value]) => {
      if (value !== undefined) {
        payload[key] = value;
      }
    });
  }

  // Forms-first validation
  const { json: form } = await opFetch<any>(env, "/api/v3/work_packages/form", {
    method: "POST",
    body: JSON.stringify({ 
      ...payload, 
      _meta: { sendNotifications: input.sendNotifications } 
    }),
  });

  const errors = form?.validationErrors ?? {};
  const hasErrors = errors && Object.keys(errors).length > 0;
  
  if (input.dryRun || hasErrors) {
    return { 
      ok: !hasErrors, 
      validationErrors: errors, 
      payload: form?.payload,
      schema: form?.schema,
      warnings: form?.warnings 
    };
  }

  // Commit creation
  const commit = form?._links?.commit;
  if (!commit?.href) {throw new Error("Form commit link missing");}
  
  const { json: created } = await opFetch<any>(env, commit.href, {
    method: commit.method || "POST",
    body: JSON.stringify(form.payload),
  });

  return { 
    ok: true, 
    workPackage: created,
    workPackageUrl: created?._links?.self?.href 
  };
}

//
// Enterprise Work Package Updates with Complete Scheduling Control
//
export const updateWorkPackageEnterpriseInput = z.object({
  id: z.union([z.string(), z.number()]).describe("Work package ID"),
  lockVersion: z.number().int().min(0).describe("Lock version for optimistic locking"),
  
  // All updatable fields
  subject: z.string().min(1).max(255).optional(),
  description: FormattableFieldSchema,
  
  // Complete scheduling updates
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedTime: DurationSchema,
  percentageDone: z.number().int().min(0).max(100).optional(),
  scheduleManually: z.boolean().optional(),
  
  // Resource updates
  assigneeId: z.union([z.string(), z.number()]).optional(),
  responsibleId: z.union([z.string(), z.number()]).optional(),
  
  // Structure updates
  parentId: z.union([z.string(), z.number()]).optional(),
  versionId: z.union([z.string(), z.number()]).optional(),
  
  // Status updates
  statusId: z.union([z.string(), z.number()]).optional(),
  priorityId: z.union([z.string(), z.number()]).optional(),
  
  // Enterprise updates
  budgetId: z.union([z.string(), z.number()]).optional(),
  categoryId: z.union([z.string(), z.number()]).optional(),
  customFields: WorkPackageCustomFieldsSchema.optional(),
  
  // Update control
  sendNotifications: z.boolean().default(true),
  dryRun: z.boolean().default(false),
}).strict();

export async function updateWorkPackageEnterprise({ env }: Ctx, input: z.infer<typeof updateWorkPackageEnterpriseInput>) {
  // Build update payload
  const payload: any = {
    lockVersion: input.lockVersion,
  };

  // Update core fields
  if (input.subject !== undefined) {payload.subject = input.subject;}
  if (input.description !== undefined) {payload.description = input.description;}
  
  // Update scheduling
  if (input.startDate !== undefined) {payload.startDate = input.startDate;}
  if (input.dueDate !== undefined) {payload.dueDate = input.dueDate;}
  if (input.estimatedTime !== undefined) {payload.estimatedTime = input.estimatedTime;}
  if (input.percentageDone !== undefined) {payload.percentageDone = input.percentageDone;}
  if (input.scheduleManually !== undefined) {payload.scheduleManually = input.scheduleManually;}

  // Update links
  payload._links = {};
  if (input.assigneeId !== undefined) {payload._links.assignee = input.assigneeId ? hal.user(input.assigneeId) : null;}
  if (input.responsibleId !== undefined) {payload._links.responsible = input.responsibleId ? hal.user(input.responsibleId) : null;}
  if (input.parentId !== undefined) {payload._links.parent = input.parentId ? hal.workPackage(input.parentId) : null;}
  if (input.versionId !== undefined) {payload._links.version = input.versionId ? { href: `/api/v3/versions/${input.versionId}` } : null;}
  if (input.statusId !== undefined) {payload._links.status = input.statusId ? hal.status(input.statusId) : null;}
  if (input.priorityId !== undefined) {payload._links.priority = input.priorityId ? hal.priority(input.priorityId) : null;}
  if (input.budgetId !== undefined) {payload._links.budget = input.budgetId ? { href: `/api/v3/budgets/${input.budgetId}` } : null;}
  if (input.categoryId !== undefined) {payload._links.category = input.categoryId ? { href: `/api/v3/categories/${input.categoryId}` } : null;}

  // Update custom fields
  if (input.customFields) {
    Object.entries(input.customFields).forEach(([key, value]) => {
      if (value !== undefined) {
        payload[key] = value;
      }
    });
  }

  // Forms-first validation
  const { json: form } = await opFetch<any>(env, `/api/v3/work_packages/${input.id}/form`, {
    method: "POST",
    body: JSON.stringify({ 
      ...payload, 
      _meta: { sendNotifications: input.sendNotifications } 
    }),
  });

  const errors = form?.validationErrors ?? {};
  const hasErrors = errors && Object.keys(errors).length > 0;
  
  if (input.dryRun || hasErrors) {
    return { 
      ok: !hasErrors, 
      validationErrors: errors, 
      payload: form?.payload,
      schema: form?.schema,
      changes: form?.changes 
    };
  }

  // Commit update
  const commit = form?._links?.commit;
  if (!commit?.href) {throw new Error("Form commit link missing");}
  
  const { json: updated } = await opFetch<any>(env, commit.href, {
    method: commit.method || "PATCH",
    body: JSON.stringify(form.payload),
  });

  return { 
    ok: true, 
    workPackage: updated,
    changes: form?.changes 
  };
}

//
// Advanced Work Package Listing with Enterprise Filters
//
export const listWorkPackagesEnterpriseInput = z.object({
  projectId: z.union([z.string(), z.number()]).optional().describe("Filter by project"),
  
  // Advanced filtering
  assigneeId: z.union([z.string(), z.number()]).optional().describe("Filter by assignee"),
  responsibleId: z.union([z.string(), z.number()]).optional().describe("Filter by responsible person"),
  statusId: z.union([z.string(), z.number()]).optional().describe("Filter by status"),
  typeId: z.union([z.string(), z.number()]).optional().describe("Filter by type"),
  priorityId: z.union([z.string(), z.number()]).optional().describe("Filter by priority"),
  versionId: z.union([z.string(), z.number()]).optional().describe("Filter by version/milestone"),
  
  // Schedule filtering
  dueDateFrom: z.string().optional().describe("Due date range start (YYYY-MM-DD)"),
  dueDateTo: z.string().optional().describe("Due date range end (YYYY-MM-DD)"),
  startDateFrom: z.string().optional().describe("Start date range start (YYYY-MM-DD)"),
  startDateTo: z.string().optional().describe("Start date range end (YYYY-MM-DD)"),
  
  // Progress filtering
  percentageDoneMin: z.number().int().min(0).max(100).optional().describe("Minimum completion %"),
  percentageDoneMax: z.number().int().min(0).max(100).optional().describe("Maximum completion %"),
  
  // Hierarchy filtering
  parentId: z.union([z.string(), z.number()]).optional().describe("Filter by parent work package"),
  topLevelOnly: z.boolean().default(false).describe("Show only top-level work packages"),
  
  // Text search
  subject: z.string().optional().describe("Subject text search"),
  
  // Custom field filters
  customFieldFilters: z.record(z.any()).optional().describe("Filter by custom field values"),
  
  // Pagination
  offset: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(200).default(25),
  
  // Sorting
  sortBy: z.array(z.array(z.string())).optional().describe('Sort criteria like [["dueDate","asc"]]'),
}).strict();

export async function listWorkPackagesEnterprise({ env }: Ctx, input: z.infer<typeof listWorkPackagesEnterpriseInput>) {
  const filters: any[] = [];
  
  // Build enterprise filters
  if (input.assigneeId !== undefined) {
    filters.push({ assignee: { operator: "=", values: [input.assigneeId.toString()] } });
  }
  
  if (input.responsibleId !== undefined) {
    filters.push({ responsible: { operator: "=", values: [input.responsibleId.toString()] } });
  }
  
  if (input.statusId !== undefined) {
    filters.push({ status: { operator: "=", values: [input.statusId.toString()] } });
  }
  
  if (input.typeId !== undefined) {
    filters.push({ type: { operator: "=", values: [input.typeId.toString()] } });
  }
  
  if (input.priorityId !== undefined) {
    filters.push({ priority: { operator: "=", values: [input.priorityId.toString()] } });
  }
  
  if (input.versionId !== undefined) {
    filters.push({ version: { operator: "=", values: [input.versionId.toString()] } });
  }

  // Date range filters
  if (input.dueDateFrom) {
    filters.push({ dueDate: { operator: ">=d", values: [input.dueDateFrom] } });
  }
  if (input.dueDateTo) {
    filters.push({ dueDate: { operator: "<=d", values: [input.dueDateTo] } });
  }
  if (input.startDateFrom) {
    filters.push({ startDate: { operator: ">=d", values: [input.startDateFrom] } });
  }
  if (input.startDateTo) {
    filters.push({ startDate: { operator: "<=d", values: [input.startDateTo] } });
  }

  // Progress filters
  if (input.percentageDoneMin !== undefined) {
    filters.push({ percentageDone: { operator: ">=", values: [input.percentageDoneMin.toString()] } });
  }
  if (input.percentageDoneMax !== undefined) {
    filters.push({ percentageDone: { operator: "<=", values: [input.percentageDoneMax.toString()] } });
  }

  // Hierarchy filters
  if (input.parentId !== undefined) {
    filters.push({ parent: { operator: "=", values: [input.parentId.toString()] } });
  } else if (input.topLevelOnly) {
    filters.push({ parent: { operator: "!*", values: [] } });
  }

  // Text search
  if (input.subject?.trim()) {
    filters.push({ subject: { operator: "~", values: [input.subject.trim()] } });
  }

  // Custom field filters
  if (input.customFieldFilters) {
    Object.entries(input.customFieldFilters).forEach(([field, value]) => {
      filters.push({ [field]: { operator: "=", values: [value] } });
    });
  }

  // Build API path
  const basePath = input.projectId ? `/api/v3/projects/${input.projectId}/work_packages` : "/api/v3/work_packages";
  
  const params: Record<string, unknown> = {
    offset: input.offset,
    pageSize: input.pageSize,
  };
  
  if (filters.length > 0) {
    params.filters = JSON.stringify(filters);
  }
  
  if (input.sortBy) {
    params.sortBy = JSON.stringify(input.sortBy);
  }

  const path = withQuery(basePath, params);
  const { json } = await opFetch<any>(env, path);
  const meta = parseCollectionMeta(json);
  const elements = json?._embedded?.elements ?? [];
  
  return { 
    elements, 
    ...meta, 
    _links: json?._links,
    appliedFilters: filters.length > 0 ? filters : undefined,
    scheduleMetrics: {
      totalWorkPackages: elements.length,
      completedCount: elements.filter((wp: any) => wp.percentageDone === 100).length,
      overdueCount: elements.filter((wp: any) => wp.dueDate && new Date(wp.dueDate) < new Date() && wp.percentageDone < 100).length,
    }
  };
}