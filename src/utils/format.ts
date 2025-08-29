// src/utils/format.ts - Formatting utilities for MCP responses and data presentation

import { APP_NAME, APP_VERSION } from "../constants/index.js";

/**
 * Format JSON data for pretty-printed text output in MCP responses
 */
export function toPrettyJson(data: any): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Format data for MCP text responses with enhanced readability
 */
export function formatForMcp(data: any, title?: string): string {
  const header = title ? `=== ${title} ===\n\n` : "";
  
  if (data === null || data === undefined) {
    return `${header}(no data)`;
  }

  if (typeof data === "string") {
    return `${header}${data}`;
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return `${header}${String(data)}`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return `${header}(empty array)`;
    }
    
    const items = data.map((item, index) => 
      `${index + 1}. ${formatItemSummary(item)}`
    ).join("\n");
    
    return `${header}${items}`;
  }

  // For objects, format as structured text
  return `${header}${toPrettyJson(data)}`;
}

/**
 * Create a brief summary of an item for list formatting
 */
function formatItemSummary(item: any): string {
  if (!item || typeof item !== "object") {
    return String(item);
  }

  // Handle OpenProject HAL resources
  if (item._type && item.id) {
    const type = item._type;
    const id = item.id;
    const name = item.name || item.subject || item.title || `${type} #${id}`;
    return `[${type}] ${name} (ID: ${id})`;
  }

  // Handle objects with common identifier fields
  if (item.name || item.subject || item.title) {
    const identifier = item.name || item.subject || item.title;
    return item.id ? `${identifier} (ID: ${item.id})` : identifier;
  }

  // Fallback to first few properties
  const keys = Object.keys(item).slice(0, 3);
  const props = keys.map(key => `${key}: ${item[key]}`).join(", ");
  return props || JSON.stringify(item);
}

/**
 * Format error messages for consistent MCP error responses
 */
export function formatError(error: any, context?: string): string {
  const prefix = context ? `[${context}] ` : "";
  
  if (error?.message) {
    return `${prefix}${error.message}`;
  }
  
  if (typeof error === "string") {
    return `${prefix}${error}`;
  }
  
  return `${prefix}Unknown error: ${JSON.stringify(error)}`;
}

/**
 * Format success messages with optional metadata
 */
export function formatSuccess(message: string, data?: any): string {
  let result = `✅ ${message}`;
  
  if (data) {
    result += `\n\n${formatForMcp(data)}`;
  }
  
  return result;
}

/**
 * Format validation errors from OpenProject forms
 */
export function formatValidationErrors(errors: any): string {
  if (!errors || typeof errors !== "object") {
    return "Validation failed (no details available)";
  }

  const errorMessages: string[] = [];
  
  for (const [field, fieldErrors] of Object.entries(errors)) {
    if (Array.isArray(fieldErrors)) {
      fieldErrors.forEach((error: any) => {
        const message = typeof error === "string" ? error : error?.message || "Invalid value";
        errorMessages.push(`• ${field}: ${message}`);
      });
    } else if (fieldErrors) {
      const message = typeof fieldErrors === "string" ? fieldErrors : 
        (fieldErrors as any)?.message || "Invalid value";
      errorMessages.push(`• ${field}: ${message}`);
    }
  }

  return errorMessages.length > 0 
    ? `Validation errors:\n${errorMessages.join("\n")}`
    : "Validation failed";
}

/**
 * Format OpenProject collection metadata for display
 */
export function formatCollectionMeta(meta: {
  total?: number;
  count?: number;
  pageSize?: number;
  offset?: number;
}): string {
  const { total, count, pageSize, offset } = meta;
  
  if (total === undefined && count === undefined) {
    return "";
  }

  const parts: string[] = [];
  
  if (count !== undefined) {
    parts.push(`Showing ${count} items`);
  }
  
  if (total !== undefined && total !== count) {
    parts.push(`of ${total} total`);
  }
  
  if (pageSize && offset !== undefined) {
    const page = Math.floor(offset / pageSize) + 1;
    parts.push(`(page ${page})`);
  }

  return parts.length > 0 ? `\n\n📊 ${parts.join(" ")}` : "";
}

/**
 * Generate header for tool responses
 */
export function formatToolHeader(toolName: string, operation?: string): string {
  const timestamp = new Date().toISOString();
  const op = operation ? ` - ${operation}` : "";
  return `🔧 ${APP_NAME} v${APP_VERSION} | ${toolName}${op}\n⏰ ${timestamp}\n`;
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Convert camelCase to Title Case for display
 */
export function camelToTitle(camelCase: string): string {
  return camelCase
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }
  
  if (hours < 24) {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return minutes > 0 ? `${wholeHours}h ${minutes}m` : `${wholeHours}h`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return dateString;
  }
}

/**
 * Format datetime for display
 */
export function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short", 
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return dateString;
  }
}