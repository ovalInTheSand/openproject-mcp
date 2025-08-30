// src/tools.ts
import { z } from "zod";
import { opFetch, parseCollectionMeta, hal, withQuery } from "./util/op";

export type Ctx = { env: any };

//
// Projects
//
export const listProjectsInput = z.object({
  q: z.string().optional().describe("Optional name/identifier substring match (client-side)"),
  offset: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(200).default(25),
});

export async function listProjects({ env }: Ctx, input: z.infer<typeof listProjectsInput>) {
  const { json } = await opFetch<any>(env, "/api/v3/projects", {
    params: { offset: input.offset, pageSize: input.pageSize },
  });
  // OpenProject collections carry total/count/pageSize/offset.
  const meta = parseCollectionMeta(json);
  let elements = json?._embedded?.elements ?? [];
  if (input.q) {
    const q = input.q.toLowerCase();
    elements = elements.filter((p: any) => `${p?.name || ""} ${p?.identifier || ""}`.toLowerCase().includes(q));
  }
  return { elements, ...meta };
}

//
// Types (global or per project)
//
export const listTypesInput = z.object({
  projectId: z.union([z.string(), z.number()]).optional(),
});
export async function listTypes({ env }: Ctx, input: z.infer<typeof listTypesInput>) {
  const path = input.projectId ? `/api/v3/projects/${input.projectId}/types` : "/api/v3/types";
  const { json } = await opFetch<any>(env, path);
  return json?._embedded?.elements ?? [];
}

//
// Work packages: list
//
// Stricter filter & sort schemas while still allowing raw pre-encoded strings for backward compatibility
const filterClause = z.record(z.object({ operator: z.string(), values: z.array(z.any()) }));
const filtersArraySchema = z.array(filterClause);
const sortTuple = z.tuple([z.string(), z.enum(["asc", "desc"])]);
const sortBySchema = z.array(sortTuple);
export const listWPsInput = z.object({
  projectId: z.union([z.string(), z.number()]).optional(),
  filters: z.union([z.string(), filtersArraySchema]).optional().describe("Array of filter objects or JSON string"),
  offset: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(200).default(25),
  sortBy: z.union([z.string(), sortBySchema]).optional().describe('Array like [["id","asc"]] or JSON string'),
});
export async function listWorkPackages({ env }: Ctx, input: z.infer<typeof listWPsInput>) {
  const base = input.projectId ? `/api/v3/projects/${input.projectId}/work_packages` : "/api/v3/work_packages";
  const params: Record<string, unknown> = {
    offset: input.offset,
    pageSize: input.pageSize,
  };
  if (input.filters !== undefined) params.filters = input.filters;
  if (input.sortBy !== undefined) params.sortBy = input.sortBy;

  const path = withQuery(base, params);
  const { json } = await opFetch<any>(env, path);
  const meta = parseCollectionMeta(json);
  const elements = json?._embedded?.elements ?? [];
  return { elements, ...meta, _links: json?._links };
}

//
// Work package: create (forms-first)
//
export const createWPInput = z.object({
  projectId: z.union([z.string(), z.number()]),
  typeId: z.union([z.string(), z.number()]),
  subject: z.string().min(1),
  description: z
    .object({ format: z.string().default("markdown"), raw: z.string().default(""), html: z.string().optional() })
    .partial()
    .optional(),
  assigneeId: z.union([z.string(), z.number()]).optional(),
  priorityId: z.union([z.string(), z.number()]).optional(),
  parentId: z.union([z.string(), z.number()]).optional(),
  startDate: z.string().optional(), // YYYY-MM-DD
  dueDate: z.string().optional(),
  notify: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});

export async function createWorkPackageViaForm({ env }: Ctx, input: z.infer<typeof createWPInput>) {
  const payload: any = {
    subject: input.subject,
    _links: {
      project: hal.project(input.projectId),
      type: hal.type(input.typeId),
    },
  };
  if (input.description) payload.description = input.description;
  if (input.assigneeId) payload._links.assignee = hal.user(input.assigneeId);
  if (input.priorityId) payload._links.priority = hal.priority(input.priorityId);
  if (input.parentId) payload._links.parent = hal.workPackage(input.parentId);
  if (input.startDate) payload.startDate = input.startDate;
  if (input.dueDate) payload.dueDate = input.dueDate;

  const { json: form } = await opFetch<any>(env, "/api/v3/work_packages/form", {
    method: "POST",
    body: JSON.stringify({ ...payload, _meta: { sendNotifications: input.notify } }),
  });
  // Forms expose "validationErrors" and a "commit" link with method (POST for create).
  const errors = form?.validationErrors ?? {};
  const hasErrors = errors && Object.keys(errors).length > 0;
  if (input.dryRun || hasErrors) {
    return { ok: !hasErrors, validationErrors: errors, payload: form?.payload, schema: form?.schema };
  }
  const commit = form?._links?.commit;
  if (!commit?.href) throw new Error("Form commit link missing");
  const { json: created } = await opFetch<any>(env, commit.href, {
    method: commit.method || "POST",
    body: JSON.stringify(form.payload),
  });
  return { ok: true, workPackage: created };
}

//
// Work package: update (PATCH; optional dry-run via forms)
//
export const updateWPInput = z.object({
  id: z.union([z.string(), z.number()]),
  lockVersion: z.number().int().min(0),
  subject: z.string().optional(),
  description: z.object({ format: z.string(), raw: z.string(), html: z.string().optional() }).partial().optional(),
  typeId: z.union([z.string(), z.number()]).optional(),
  statusId: z.union([z.string(), z.number()]).optional(),
  assigneeId: z.union([z.string(), z.number()]).optional(),
  priorityId: z.union([z.string(), z.number()]).optional(),
  parentId: z.union([z.string(), z.number()]).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  notify: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});

export async function updateWorkPackage({ env }: Ctx, input: z.infer<typeof updateWPInput>) {
  // Build payload for PATCH /api/v3/work_packages/{id} per spec.
  const body: any = { lockVersion: input.lockVersion };
  if (input.subject !== undefined) body.subject = input.subject;
  if (input.description) body.description = input.description;
  body._links = body._links || {};
  if (input.typeId) body._links.type = hal.type(input.typeId);
  if (input.statusId) body._links.status = hal.status(input.statusId);
  if (input.assigneeId) body._links.assignee = hal.user(input.assigneeId);
  if (input.priorityId) body._links.priority = hal.priority(input.priorityId);
  if (input.parentId) body._links.parent = hal.workPackage(input.parentId);
  if (input.startDate) body.startDate = input.startDate;
  if (input.dueDate) body.dueDate = input.dueDate;

  if (input.dryRun) {
    // Validate via forms mechanism (do not commit).
    const { json: form } = await opFetch<any>(env, `/api/v3/work_packages/${input.id}/form`, {
      method: "POST",
      body: JSON.stringify({ ...body, _meta: { sendNotifications: input.notify } }),
    });
    const errors = form?.validationErrors ?? {};
    const hasErrors = errors && Object.keys(errors).length > 0;
    return { ok: !hasErrors, validationErrors: errors, payload: form?.payload, schema: form?.schema };
  }

  const { json: updated } = await opFetch<any>(env, `/api/v3/work_packages/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...body, _meta: { sendNotifications: input.notify } }),
  });
  return { ok: true, workPackage: updated };
}

//
// Attachments: add file to a WP (multipart/form-data)
//
export const attachInput = z.object({
  workPackageId: z.union([z.string(), z.number()]),
  fileName: z.string().min(1),
  dataBase64: z.string().min(1),
  contentType: z.string().default("application/octet-stream"),
  description: z.string().optional(),
});

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB safeguard
export async function attachToWorkPackage({ env }: Ctx, input: z.infer<typeof attachInput>) {
  const b64 = input.dataBase64.trim();
  const padding = (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  const approxSize = Math.floor((b64.length * 3) / 4) - padding;
  if (approxSize > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment exceeds max size of ${MAX_ATTACHMENT_BYTES} bytes (approx ${approxSize}).`);
  }
  const form = new FormData();
  const metadata = {
    fileName: input.fileName,
    description: input.description ? { format: "plain", raw: input.description } : undefined,
  };
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json");
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("Invalid base64 data");
  }
  // Cast to ArrayBuffer to satisfy TS in some environments
  const pureBuffer = new Uint8Array(bytes).buffer; // guarantee ArrayBuffer instance
  form.append("file", new Blob([pureBuffer], { type: input.contentType }), input.fileName);
  const { json } = await opFetch<any>(env, `/api/v3/work_packages/${input.workPackageId}/attachments`, {
    method: "POST",
    body: form as any,
    headers: {},
  });
  return json;
}

//
// Queries: list & run
//
export const listQueriesInput = z.object({
  // optional filters JSON for the queries collection (e.g., [{"starred":{"operator":"=","values":["t"]}}])
  filters: z.any().optional(),
  offset: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(200).default(25),
});

export async function listQueries({ env }: Ctx, input: z.infer<typeof listQueriesInput>) {
  const params: Record<string, unknown> = { offset: input.offset, pageSize: input.pageSize };
  if (input.filters !== undefined) params.filters = input.filters;
  const { json } = await opFetch<any>(env, "/api/v3/queries", { params });
  const meta = parseCollectionMeta(json);
  const elements = json?._embedded?.elements ?? [];
  return { elements, ...meta };
}

export const runQueryInput = z.object({
  id: z.union([z.string(), z.number()]),
  // Optional overrides per spec: filters/offset/pageSize/sortBy/groupBy/showSums/timestamps.
  filters: z.any().optional(),
  offset: z.number().int().min(0).optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
  sortBy: z.any().optional(),
  groupBy: z.string().optional(),
  showSums: z.boolean().optional(),
  timestamps: z.string().optional(),
});

export async function runQuery({ env }: Ctx, input: z.infer<typeof runQueryInput>) {
  const params: Record<string, unknown> = {};
  for (const k of ["filters", "offset", "pageSize", "sortBy", "groupBy", "showSums", "timestamps"] as const) {
    const v = (input as any)[k];
    if (v !== undefined) params[k] = v;
  }
  const { json: q } = await opFetch<any>(env, `/api/v3/queries/${input.id}`, { params });

  // If results are embedded, return them; otherwise follow the "results" link described by docs.
  if (q?._embedded?.results) {
    const meta = parseCollectionMeta(q._embedded.results);
    const elements = q._embedded.results?._embedded?.elements ?? [];
    return { query: q, results: { elements, ...meta, _links: q._embedded.results?._links } };
  }

  const href: string | undefined = q?._links?.results?.href;
  if (!href) return { query: q, results: null };

  const { json } = await opFetch<any>(env, href);
  const meta = parseCollectionMeta(json);
  const elements = json?._embedded?.elements ?? [];
  return { query: q, results: { elements, ...meta, _links: json?._links } };
}
