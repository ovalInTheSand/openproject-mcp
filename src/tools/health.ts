// src/tools/health.ts
import { z } from "zod";
import { opFetch } from "../util/op";
import type { Ctx } from "../tools";

//
// Health: check OpenProject connectivity and auth
//
export const healthCheckInput = z.object({});

export async function healthCheck({ env }: Ctx, _input: z.infer<typeof healthCheckInput>) {
  const { json, res } = await opFetch<any>(env, "/api/v3/");
  return {
    status: "ok",
    statusCode: res.status,
    instanceName: json?.instanceName || "unknown",
    version: json?.version || "unknown",
    _links: json?._links,
  };
}