// src/sse.ts
import { Context } from "hono";
import { z } from "zod";

// SSE Connection management
interface SSEConnection {
  id: string;
  context: Context;
  filters: SSEFilters;
  lastEventId?: string;
  isActive: boolean;
  send: (payload: string) => boolean; // push event to client
}

// SSE Event filters
interface SSEFilters {
  projectIds?: string[];
  workPackageIds?: string[];
  toolTypes?: string[];
  eventTypes?: string[];
}

// SSE Event types
type SSEEventType = 
  | 'project_update'
  | 'work_package_update' 
  | 'time_entry_update'
  | 'tool_execution'
  | 'error'
  | 'heartbeat';

interface SSEEvent {
  id: string;
  type: SSEEventType;
  data: any;
  timestamp: string;
  projectId?: string;
  workPackageId?: string;
}

// Global connection store (in production, use Redis or similar)
const connections = new Map<string, SSEConnection>();
const encoder = new TextEncoder();
let eventCounter = 0;

// SSE subscription schema
export const sseSubscribeInput = z.object({
  projectIds: z.array(z.string()).optional(),
  workPackageIds: z.array(z.string()).optional(), 
  toolTypes: z.array(z.string()).optional(),
  eventTypes: z.array(z.string()).optional(),
  lastEventId: z.string().optional()
});

/**
 * Handle SSE connection establishment
 */
export async function handleSSEConnection(c: Context): Promise<Response> {
  const url = new URL(c.req.url);
  const filters: SSEFilters = {
    projectIds: url.searchParams.getAll('projectId'),
    workPackageIds: url.searchParams.getAll('workPackageId'),
    toolTypes: url.searchParams.getAll('toolType'),
    eventTypes: url.searchParams.getAll('eventType')
  };
  
  const lastEventId = c.req.header('Last-Event-ID');
  const connectionId = generateConnectionId();

  // Set SSE headers according to WHATWG specification
  const headers = new Headers({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'Access-Control-Expose-Headers': 'Content-Type',
  });

  // Create readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      let controllerOpen = true;
      const connection: SSEConnection = {
        id: connectionId,
        context: c,
        filters,
        lastEventId,
        isActive: true,
        send: (payload: string) => {
          if (!controllerOpen) return false;
          try {
            controller.enqueue(encoder.encode(payload));
            return true;
          } catch {
            controllerOpen = false;
            return false;
          }
        }
      };

      // Store connection
      connections.set(connectionId, connection);

      // Send initial connection event
      const initEvent = formatSSEEvent({
        id: generateEventId(),
        type: 'heartbeat',
        data: { message: 'Connected', connectionId },
        timestamp: new Date().toISOString()
      });
      
  connection.send(initEvent);

      // Send missed events if lastEventId provided
      if (lastEventId) {
        // In production, implement event replay from persistent storage
        const missedEvent = formatSSEEvent({
          id: generateEventId(),
          type: 'heartbeat',
          data: { message: 'Replay not implemented in demo', lastEventId },
          timestamp: new Date().toISOString()
        });
  connection.send(missedEvent);
      }

      // Setup heartbeat to prevent connection timeout
      const heartbeatInterval = setInterval(() => {
        if (connection.isActive) {
          const heartbeat = formatSSEEvent({
            id: generateEventId(),
            type: 'heartbeat',
            data: { timestamp: new Date().toISOString() },
            timestamp: new Date().toISOString()
          });
          
          if (!connection.send(heartbeat)) cleanup();
        } else {
          cleanup();
        }
      }, 30000); // 30 second heartbeat

      // Cleanup function
      const cleanup = () => {
        connection.isActive = false;
        connections.delete(connectionId);
        clearInterval(heartbeatInterval);
  try { controller.close(); } catch {}
  controllerOpen = false;
      };

      // Handle client disconnect
      c.req.raw.signal?.addEventListener('abort', cleanup);
    },

    cancel() {
      const connection = connections.get(connectionId);
      if (connection) {
        connection.isActive = false;
        connections.delete(connectionId);
      }
    }
  });

  return new Response(stream, { headers });
}

/**
 * Broadcast event to all matching connections
 */
export function broadcastSSEEvent(event: SSEEvent): void {
  const message = formatSSEEvent(event);
  connections.forEach((connection) => {
    if (!connection.isActive) {
      connections.delete(connection.id);
      return;
    }
    if (!eventMatchesFilters(event, connection.filters)) return;
    const ok = connection.send(message);
    if (!ok) {
      connection.isActive = false;
      connections.delete(connection.id);
    }
  });
}

/**
 * Format event according to SSE specification
 */
function formatSSEEvent(event: SSEEvent): string {
  const lines: string[] = [];
  
  // Add event ID
  if (event.id) {
    lines.push(`id: ${event.id}`);
  }
  
  // Add event type (default SSE event type is 'message')
  if (event.type) {
    lines.push(`event: ${event.type}`);
  }
  
  // Add data (can be multiple lines)
  const dataStr = typeof event.data === 'string' 
    ? event.data 
    : JSON.stringify(event.data);
    
  dataStr.split('\n').forEach(line => {
    lines.push(`data: ${line}`);
  });
  
  // Add empty line to trigger event dispatch
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Check if event matches connection filters
 */
function eventMatchesFilters(event: SSEEvent, filters: SSEFilters): boolean {
  // Filter by project IDs
  if (filters.projectIds?.length && event.projectId) {
    if (!filters.projectIds.includes(event.projectId)) {
      return false;
    }
  }
  
  // Filter by work package IDs
  if (filters.workPackageIds?.length && event.workPackageId) {
    if (!filters.workPackageIds.includes(event.workPackageId)) {
      return false;
    }
  }
  
  // Filter by event types
  if (filters.eventTypes?.length) {
    if (!filters.eventTypes.includes(event.type)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Generate unique connection ID
 */
function generateConnectionId(): string {
  return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  return `${Date.now()}_${++eventCounter}`;
}

/**
 * Helper functions for tool integrations
 */
export function notifyProjectUpdate(projectId: string, data: any): void {
  broadcastSSEEvent({
    id: generateEventId(),
    type: 'project_update',
    data,
    timestamp: new Date().toISOString(),
    projectId
  });
}

export function notifyWorkPackageUpdate(workPackageId: string, projectId: string, data: any): void {
  broadcastSSEEvent({
    id: generateEventId(),
    type: 'work_package_update', 
    data,
    timestamp: new Date().toISOString(),
    projectId,
    workPackageId
  });
}

export function notifyToolExecution(toolName: string, projectId: string, data: any): void {
  broadcastSSEEvent({
    id: generateEventId(),
    type: 'tool_execution',
    data: { toolName, ...data },
    timestamp: new Date().toISOString(),
    projectId
  });
}

/**
 * Get connection statistics for monitoring
 */
export function getSSEStats(): { activeConnections: number; totalConnections: number } {
  const activeConnections = Array.from(connections.values()).filter(c => c.isActive).length;
  return {
    activeConnections,
    totalConnections: connections.size
  };
}