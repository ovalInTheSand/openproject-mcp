// src/tools/priorities.ts
import { z } from "zod";
import { opFetch } from "../util/op";
import type { Ctx } from "../tools";

//
// Priorities: list (global or per-project)
//
export const listPrioritiesInput = z.object({
  projectId: z.union([z.string(), z.number()]).optional(),
});

export async function listPriorities({ env }: Ctx, input: z.infer<typeof listPrioritiesInput>) {
  const path = input.projectId ? `/api/v3/projects/${input.projectId}/priorities` : "/api/v3/priorities";
  const { json } = await opFetch<any>(env, path);
  const elements = json?._embedded?.elements ?? [];
  return { elements, total: elements.length };
}