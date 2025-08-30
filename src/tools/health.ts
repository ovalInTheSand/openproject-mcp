// src/tools/health.ts
import { z } from "zod";
import { opFetch } from "../util/op";
import type { Ctx } from "../tools";
import { notifyToolExecution } from "../sse";

//
// Health: check OpenProject connectivity and auth
//
export const healthCheckInput = z.object({});

export async function healthCheck({ env }: Ctx, _input: z.infer<typeof healthCheckInput>) {
  const { json, res } = await opFetch<any>(env, "/api/v3/");
  const result = {
    status: "ok",
    statusCode: res.status,
    instanceName: json?.instanceName || "unknown",
    version: json?.version || "unknown",
    _links: json?._links,
  };
  
  // Notify SSE clients about health check execution
  notifyToolExecution('op.health', 'global', {
    result,
    timestamp: new Date().toISOString()
  });
  
  return result;
}