// src/tools/projects.ts
import { z } from "zod";
import { opFetch, parseCollectionMeta, hal } from "../util/op";
import type { Ctx } from "../tools";

//
// Enterprise Project Management - Full PMBOK/PMP Schema
//

// Formattable field schema (supports markdown)
const FormattableFieldSchema = z.object({
  format: z.string().default("markdown"),
  raw: z.string(),
  html: z.string().optional(),
}).optional();

// Custom field support (OpenProject supports 30+ dynamic custom fields)
const CustomFieldsSchema = z.object({
  customField1: z.any().optional(), // Budget code
  customField2: z.any().optional(), // Program alignment
  customField3: z.any().optional(), // Risk category
  customField4: z.any().optional(), // Stakeholder priority
  customField5: z.any().optional(), // Phase gate requirements
  customField6: z.any().optional(), // Compliance category
  customField7: z.any().optional(), // Business unit
  customField8: z.any().optional(), // Project manager level
  customField9: z.any().optional(), // Strategic priority
  customField10: z.any().optional(), // Resource pool
}).partial();

//
// Project Creation (Enterprise Schema)
//
export const createProjectInput = z.object({
  // Core PMBOK fields (required)
  name: z.string().min(1).max(255).describe("Project name (1-255 characters)"),
  identifier: z.string().min(1).max(100).describe("Unique project identifier (1-100 characters)"),
  
  // Enterprise project fields
  description: FormattableFieldSchema.describe("Project description with markdown support"),
  active: z.boolean().default(true).describe("Project active status"),
  public: z.boolean().default(false).describe("Project visibility (public/private)"),
  
  // Project hierarchy (enterprise)
  parentId: z.union([z.string(), z.number()]).optional().describe("Parent project ID for sub-projects"),
  
  // Status management
  statusExplanation: z.string().optional().describe("Explanation of current project status"),
  
  // Enterprise custom fields (PMP-level customization)
  customFields: CustomFieldsSchema.optional().describe("Organization-specific custom fields"),
  
  // Forms validation
  dryRun: z.boolean().default(false).describe("Validate only without creating"),
  sendNotifications: z.boolean().default(true).describe("Send notifications to stakeholders"),
}).strict();

export async function createProject({ env }: Ctx, input: z.infer<typeof createProjectInput>) {
  // Build enterprise project payload
  const payload: any = {
    name: input.name,
    identifier: input.identifier,
    active: input.active,
    public: input.public,
  };

  // Add optional enterprise fields
  if (input.description) payload.description = input.description;
  if (input.statusExplanation) payload.statusExplanation = input.statusExplanation;
  
  // Project hierarchy support
  if (input.parentId) {
    payload._links = payload._links || {};
    payload._links.parent = hal.project(input.parentId);
  }

  // Custom fields integration (enterprise)
  if (input.customFields) {
    Object.entries(input.customFields).forEach(([key, value]) => {
      if (value !== undefined) {
        payload[key] = value;
      }
    });
  }

  // Use forms-first validation (PMBOK compliance)
  const { json: form } = await opFetch<any>(env, "/api/v3/projects/form", {
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

  // Commit project creation
  const commit = form?._links?.commit;
  if (!commit?.href) throw new Error("Form commit link missing - insufficient permissions");
  
  const { json: created } = await opFetch<any>(env, commit.href, {
    method: commit.method || "POST",
    body: JSON.stringify(form.payload),
  });

  return { 
    ok: true, 
    project: created,
    projectUrl: created?._links?.self?.href 
  };
}

//
// Project Updates (Enterprise Schema)
//
export const updateProjectInput = z.object({
  id: z.union([z.string(), z.number()]).describe("Project ID to update"),
  
  // Core updatable fields
  name: z.string().min(1).max(255).optional(),
  description: FormattableFieldSchema,
  active: z.boolean().optional(),
  public: z.boolean().optional(),
  statusExplanation: z.string().optional(),
  
  // Hierarchy updates
  parentId: z.union([z.string(), z.number()]).optional(),
  
  // Enterprise custom fields
  customFields: CustomFieldsSchema.optional(),
  
  // Update control
  sendNotifications: z.boolean().default(true),
  dryRun: z.boolean().default(false),
}).strict();

export async function updateProject({ env }: Ctx, input: z.infer<typeof updateProjectInput>) {
  // Get current project for lockVersion and existing data
  const { json: current } = await opFetch<any>(env, `/api/v3/projects/${input.id}`);
  
  const payload: any = {
    lockVersion: current.lockVersion,
  };

  // Update core fields
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.active !== undefined) payload.active = input.active;
  if (input.public !== undefined) payload.public = input.public;
  if (input.statusExplanation !== undefined) payload.statusExplanation = input.statusExplanation;

  // Update hierarchy
  payload._links = current._links || {};
  if (input.parentId !== undefined) {
    payload._links.parent = input.parentId ? hal.project(input.parentId) : null;
  }

  // Update custom fields
  if (input.customFields) {
    Object.entries(input.customFields).forEach(([key, value]) => {
      if (value !== undefined) {
        payload[key] = value;
      }
    });
  }

  // Forms-first validation
  const { json: form } = await opFetch<any>(env, `/api/v3/projects/${input.id}/form`, {
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
  if (!commit?.href) throw new Error("Form commit link missing");
  
  const { json: updated } = await opFetch<any>(env, commit.href, {
    method: commit.method || "PATCH",
    body: JSON.stringify(form.payload),
  });

  return { 
    ok: true, 
    project: updated,
    changes: form?.changes 
  };
}

//
// Project Archival (Enterprise Lifecycle Management)
//
export const archiveProjectInput = z.object({
  id: z.union([z.string(), z.number()]).describe("Project ID to archive"),
  reason: z.string().optional().describe("Reason for archiving project"),
}).strict();

export async function archiveProject({ env }: Ctx, input: z.infer<typeof archiveProjectInput>) {
  return await updateProject({ env }, {
    id: input.id,
    active: false,
    statusExplanation: input.reason || "Project archived",
    sendNotifications: true,
  });
}

//
// Enhanced Project Listing with Enterprise Filters
//
export const listProjectsEnterpriseInput = z.object({
  // Basic filtering
  q: z.string().optional().describe("Name/identifier substring match"),
  active: z.boolean().optional().describe("Filter by active status"),
  public: z.boolean().optional().describe("Filter by public visibility"),
  
  // Hierarchy filtering
  parentId: z.union([z.string(), z.number()]).optional().describe("Filter by parent project"),
  topLevelOnly: z.boolean().default(false).describe("Show only top-level projects"),
  
  // Enterprise filtering
  customFieldFilters: z.record(z.any()).optional().describe("Filter by custom field values"),
  
  // Pagination
  offset: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(200).default(25),
  
  // Sorting
  sortBy: z.array(z.array(z.string())).optional().describe('Sort criteria like [["name","asc"]]'),
}).strict();

export async function listProjectsEnterprise({ env }: Ctx, input: z.infer<typeof listProjectsEnterpriseInput>) {
  const filters: any[] = [];
  
  // Build enterprise filters
  if (input.active !== undefined) {
    filters.push({ active: { operator: "=", values: [input.active.toString()] } });
  }
  
  if (input.public !== undefined) {
    filters.push({ public: { operator: "=", values: [input.public.toString()] } });
  }
  
  if (input.parentId !== undefined) {
    filters.push({ parent: { operator: "=", values: [input.parentId.toString()] } });
  } else if (input.topLevelOnly) {
    filters.push({ parent: { operator: "!*", values: [] } });
  }

  if (input.q?.trim()) {
    filters.push({ name: { operator: "~", values: [input.q.trim()] } });
  }

  // Custom field filters (enterprise)
  if (input.customFieldFilters) {
    Object.entries(input.customFieldFilters).forEach(([field, value]) => {
      filters.push({ [field]: { operator: "=", values: [value] } });
    });
  }

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

  const { json } = await opFetch<any>(env, "/api/v3/projects", { params });
  const meta = parseCollectionMeta(json);
  const elements = json?._embedded?.elements ?? [];
  
  return { 
    elements, 
    ...meta, 
    _links: json?._links,
    appliedFilters: filters.length > 0 ? filters : undefined 
  };
}