// src/tools/users.ts
import { z } from "zod";
import { opFetch, parseCollectionMeta, withQuery } from "../util/op.js";
import type { Ctx } from "../tools";

//
// Users: search by name or get current user
//
export const searchUsersInput = z.object({
  q: z.string().optional().describe("Search term for user name/login"),
  offset: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(200).default(25),
});

export async function searchUsers({ env }: Ctx, input: z.infer<typeof searchUsersInput>) {
  const params: Record<string, unknown> = {
    offset: input.offset,
    pageSize: input.pageSize,
  };
  
  // Add name filter if search term provided
  if (input.q?.trim()) {
    params.filters = JSON.stringify([
      { name: { operator: "~", values: [input.q.trim()] } }
    ]);
  }

  const path = withQuery("/api/v3/users", params);
  const { json } = await opFetch<any>(env, path);
  const meta = parseCollectionMeta(json);
  const elements = json?._embedded?.elements ?? [];
  return { elements, ...meta };
}

//
// Get current authenticated user
//
export const getCurrentUserInput = z.object({});

export async function getCurrentUser({ env }: Ctx, _input: z.infer<typeof getCurrentUserInput>) {
  const { json } = await opFetch<any>(env, "/api/v3/users/me");
  return json;
}