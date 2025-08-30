// src/tools/versions.ts
import { z } from "zod";
import { opFetch, parseCollectionMeta } from "../util/op";
import type { Ctx } from "../tools";

//
// Versions: list (per-project)
//
export const listVersionsInput = z.object({
  projectId: z.union([z.string(), z.number()]),
  offset: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(200).default(25),
});

export async function listVersions({ env }: Ctx, input: z.infer<typeof listVersionsInput>) {
  const { json } = await opFetch<any>(env, `/api/v3/projects/${input.projectId}/versions`, {
    params: { offset: input.offset, pageSize: input.pageSize },
  });
  const meta = parseCollectionMeta(json);
  const elements = json?._embedded?.elements ?? [];
  return { elements, ...meta };
}