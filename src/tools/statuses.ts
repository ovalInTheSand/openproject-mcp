// src/tools/statuses.ts
import { z } from "zod";
import { opFetch } from "../util/op";
import type { Ctx } from "../tools";

//
// Statuses: list (global or per-project)
//
export const listStatusesInput = z.object({
  projectId: z.union([z.string(), z.number()]).optional(),
});

export async function listStatuses({ env }: Ctx, input: z.infer<typeof listStatusesInput>) {
  const path = input.projectId ? `/api/v3/projects/${input.projectId}/statuses` : "/api/v3/statuses";
  const { json } = await opFetch<any>(env, path);
  const elements = json?._embedded?.elements ?? [];
  return { elements, total: elements.length };
}