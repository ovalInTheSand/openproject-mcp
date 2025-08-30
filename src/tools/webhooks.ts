// src/tools/webhooks.ts
import { z } from "zod";
import { opFetch } from "../util/op";
import type { Ctx } from "../tools";

/**
 * Enhanced Webhooks API Tools
 * 
 * Leverages OpenProject's latest webhook capabilities for real-time updates including:
 * - Work package comments and updates
 * - Time entries
 * - Attachments
 * - Project changes
 */

// Webhook event types supported by OpenProject 2024-2025
const WebhookEventSchema = z.enum([
  'work_package:created',
  'work_package:updated', 
  'work_package:deleted',
  'work_package:commented',
  'time_entry:created',
  'time_entry:updated',
  'time_entry:deleted', 
  'attachment:created',
  'attachment:deleted',
  'project:created',
  'project:updated',
  'project:deleted'
]).describe("OpenProject webhook event types");

// Create webhook configuration
export const createWebhookInput = z.object({
  name: z.string().min(1)
    .describe("Webhook name for identification"),
  url: z.string().url()
    .describe("Webhook endpoint URL to receive events"),
  events: z.array(WebhookEventSchema)
    .min(1)
    .describe("Array of events to subscribe to"),
  secret: z.string().optional()
    .describe("Secret for webhook signature verification"),
  enabled: z.boolean().default(true)
    .describe("Whether webhook is active"),
  description: z.string().optional()
    .describe("Optional description of webhook purpose"),
  projects: z.array(z.union([z.string(), z.number()])).optional()
    .describe("Specific project IDs to filter events (empty = all projects)")
}).strict();

export async function createWebhook({ env }: Ctx, input: z.infer<typeof createWebhookInput>) {
  try {
    const payload: any = {
      name: input.name,
      url: input.url,
      events: input.events,
      enabled: input.enabled,
      description: input.description || `MCP Webhook: ${input.name}`,
      secret: input.secret
    };
    
    // Add project filters if specified
    if (input.projects && input.projects.length > 0) {
      payload.projects = input.projects.map(id => ({ id: String(id) }));
    }
    
    const { json: webhook } = await opFetch<any>(env, "/api/v3/webhooks", {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    return {
      success: true,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.enabled,
        secret: !!webhook.secret, // Don't return actual secret
        createdAt: webhook.createdAt,
        _links: webhook._links
      },
      mcpIntegration: {
        realTimeUpdates: true,
        eventsSupported: input.events.length,
        projectFiltered: !!(input.projects?.length)
      }
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to create webhook: ${error.message}`,
      suggestion: "Ensure you have admin permissions and the webhook URL is accessible"
    };
  }
}

// List existing webhooks
export const listWebhooksInput = z.object({
  includeDisabled: z.boolean().default(false)
    .describe("Include disabled webhooks in results"),
  pageSize: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0)
}).strict();

export async function listWebhooks({ env }: Ctx, input: z.infer<typeof listWebhooksInput>) {
  try {
    const params: any = {
      pageSize: input.pageSize,
      offset: input.offset
    };
    
    // Filter by enabled status if needed
    if (!input.includeDisabled) {
      params.filters = JSON.stringify([{
        enabled: { operator: '=', values: ['true'] }
      }]);
    }
    
    const { json } = await opFetch<any>(env, "/api/v3/webhooks", { params });
    
    const webhooks = (json?._embedded?.elements || []).map((webhook: any) => ({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events || [],
      enabled: webhook.enabled,
      hasSecret: !!webhook.secret,
      description: webhook.description,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      projectFilters: webhook.projects || [],
      _links: webhook._links
    }));
    
    return {
      webhooks,
      total: json?.total || 0,
      count: webhooks.length,
      pageSize: input.pageSize,
      offset: input.offset,
      mcpInfo: {
        realTimeCapable: webhooks.length > 0,
        eventsConfigured: webhooks.reduce((sum: number, w: any) => sum + w.events.length, 0)
      }
    };
    
  } catch (error: any) {
    return {
      error: `Failed to list webhooks: ${error.message}`,
      webhooks: []
    };
  }
}

// Update webhook configuration
export const updateWebhookInput = z.object({
  webhookId: z.union([z.string(), z.number()])
    .describe("Webhook ID to update"),
  name: z.string().optional()
    .describe("Updated webhook name"),
  url: z.string().url().optional()
    .describe("Updated webhook URL"),
  events: z.array(WebhookEventSchema).optional()
    .describe("Updated events to subscribe to"),
  enabled: z.boolean().optional()
    .describe("Enable/disable webhook"),
  secret: z.string().optional()
    .describe("Updated secret for signature verification"),
  description: z.string().optional()
    .describe("Updated description"),
  projects: z.array(z.union([z.string(), z.number()])).optional()
    .describe("Updated project filters")
}).strict();

export async function updateWebhook({ env }: Ctx, input: z.infer<typeof updateWebhookInput>) {
  try {
    // Build update payload with only provided fields
    const payload: any = {};
    
    if (input.name !== undefined) payload.name = input.name;
    if (input.url !== undefined) payload.url = input.url;
    if (input.events !== undefined) payload.events = input.events;
    if (input.enabled !== undefined) payload.enabled = input.enabled;
    if (input.secret !== undefined) payload.secret = input.secret;
    if (input.description !== undefined) payload.description = input.description;
    if (input.projects !== undefined) {
      payload.projects = input.projects.map(id => ({ id: String(id) }));
    }
    
    const { json: webhook } = await opFetch<any>(env, `/api/v3/webhooks/${input.webhookId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    
    return {
      success: true,
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.enabled,
        hasSecret: !!webhook.secret,
        updatedAt: webhook.updatedAt,
        _links: webhook._links
      }
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to update webhook: ${error.message}`,
      webhookId: input.webhookId
    };
  }
}

// Delete webhook
export const deleteWebhookInput = z.object({
  webhookId: z.union([z.string(), z.number()])
    .describe("Webhook ID to delete")
}).strict();

export async function deleteWebhook({ env }: Ctx, input: z.infer<typeof deleteWebhookInput>) {
  try {
    await opFetch<any>(env, `/api/v3/webhooks/${input.webhookId}`, {
      method: 'DELETE'
    });
    
    return {
      success: true,
      webhookId: input.webhookId,
      deletedAt: new Date().toISOString()
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to delete webhook: ${error.message}`,
      webhookId: input.webhookId
    };
  }
}

// Test webhook delivery
export const testWebhookInput = z.object({
  webhookId: z.union([z.string(), z.number()])
    .describe("Webhook ID to test"),
  eventType: WebhookEventSchema.optional()
    .describe("Specific event type to test (defaults to work_package:updated)")
}).strict();

export async function testWebhook({ env }: Ctx, input: z.infer<typeof testWebhookInput>) {
  try {
    const testPayload = {
      eventType: input.eventType || 'work_package:updated',
      test: true
    };
    
    const { json: result } = await opFetch<any>(env, `/api/v3/webhooks/${input.webhookId}/test`, {
      method: 'POST',
      body: JSON.stringify(testPayload)
    });
    
    return {
      success: true,
      webhookId: input.webhookId,
      testResult: result,
      deliveryStatus: result?.delivered ? 'success' : 'failed',
      responseCode: result?.responseCode,
      responseTime: result?.responseTime,
      testedAt: new Date().toISOString()
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to test webhook: ${error.message}`,
      webhookId: input.webhookId
    };
  }
}

// Get webhook delivery logs
export const getWebhookLogsInput = z.object({
  webhookId: z.union([z.string(), z.number()])
    .describe("Webhook ID to get logs for"),
  limit: z.number().int().min(1).max(100).default(20)
    .describe("Number of recent deliveries to retrieve"),
  successOnly: z.boolean().default(false)
    .describe("Show only successful deliveries")
}).strict();

export async function getWebhookLogs({ env }: Ctx, input: z.infer<typeof getWebhookLogsInput>) {
  try {
    const params: any = { limit: input.limit };
    
    if (input.successOnly) {
      params.filters = JSON.stringify([{
        success: { operator: '=', values: ['true'] }
      }]);
    }
    
    const { json } = await opFetch<any>(env, `/api/v3/webhooks/${input.webhookId}/deliveries`, { params });
    
    const deliveries = (json?._embedded?.elements || []).map((delivery: any) => ({
      id: delivery.id,
      eventType: delivery.eventType,
      deliveredAt: delivery.deliveredAt,
      success: delivery.success,
      responseCode: delivery.responseCode,
      responseTime: delivery.responseTime,
      retryCount: delivery.retryCount || 0,
      errorMessage: delivery.errorMessage
    }));
    
    // Calculate delivery statistics
    const stats = {
      total: deliveries.length,
      successful: deliveries.filter((d: any) => d.success).length,
      failed: deliveries.filter((d: any) => !d.success).length,
      averageResponseTime: deliveries.reduce((sum: number, d: any) => sum + (d.responseTime || 0), 0) / deliveries.length || 0
    };
    
    return {
      webhookId: input.webhookId,
      deliveries,
      statistics: stats,
      realTimePerformance: {
        successRate: stats.total > 0 ? (stats.successful / stats.total) * 100 : 0,
        reliability: stats.successful > stats.failed ? 'good' : 'needs_attention',
        averageLatency: Math.round(stats.averageResponseTime)
      }
    };
    
  } catch (error: any) {
    return {
      error: `Failed to get webhook logs: ${error.message}`,
      webhookId: input.webhookId
    };
  }
}

// Validate webhook signature (for incoming webhook handling)
export const validateWebhookSignatureInput = z.object({
  payload: z.string()
    .describe("Webhook payload as string"),
  signature: z.string()
    .describe("Webhook signature from header"),
  secret: z.string()
    .describe("Webhook secret for validation")
}).strict();

export async function validateWebhookSignature({ env }: Ctx, input: z.infer<typeof validateWebhookSignatureInput>) {
  try {
    // OpenProject uses HMAC-SHA256 for webhook signatures
    // Use Web Crypto API (available in Cloudflare Workers)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(input.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(input.payload));
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const providedSignature = input.signature.replace('sha256=', '');
    
    // Constant-time comparison
    let isValid = expectedSignature.length === providedSignature.length;
    for (let i = 0; i < expectedSignature.length; i++) {
      isValid = isValid && (expectedSignature[i] === providedSignature[i]);
    }
    
    return {
      valid: isValid,
      algorithm: 'HMAC-SHA256',
      providedSignature,
      expectedSignature: isValid ? 'matches' : 'mismatch',
      securityNote: 'Always validate webhook signatures in production',
      environment: 'Cloudflare Workers compatible'
    };
    
  } catch (error: any) {
    return {
      valid: false,
      error: `Signature validation failed: ${error.message}`,
      algorithm: 'HMAC-SHA256'
    };
  }
}