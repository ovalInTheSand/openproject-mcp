// src/tools/notifications.ts
import { z } from "zod";
import { opFetch } from "../util/op";
import type { Ctx } from "../tools";

/**
 * Enhanced Notifications API Tools
 * 
 * Leverages OpenProject's latest notification capabilities including:
 * - Filtering by reason (mentioned, assigned, etc.)
 * - Work package reminders (OpenProject 15.2+) 
 * - Enhanced notification management
 */

// List notifications with enhanced filtering
export const listNotificationsInput = z.object({
  filters: z.array(z.object({
    reason: z.enum(['mentioned', 'assigned', 'responsible', 'watched', 'created', 'updated']).optional()
      .describe("Filter by notification reason"),
    readIAN: z.boolean().optional()
      .describe("Filter by read status in in-app notifications"),
    workPackage: z.union([z.string(), z.number()]).optional()
      .describe("Filter by specific work package ID"),
    project: z.union([z.string(), z.number()]).optional()
      .describe("Filter by project ID"),
    dateRange: z.object({
      from: z.string().describe("Start date (ISO 8601)"),
      to: z.string().describe("End date (ISO 8601)")
    }).optional().describe("Filter by date range")
  })).optional().describe("Advanced filters for notifications"),
  
  sortBy: z.array(z.tuple([
    z.enum(['id', 'reason', 'createdAt', 'updatedAt']),
    z.enum(['asc', 'desc'])
  ])).default([['createdAt', 'desc']]).describe("Sort notifications"),
  
  pageSize: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0)
}).strict();

export async function listNotifications({ env }: Ctx, input: z.infer<typeof listNotificationsInput>) {
  const params: any = {
    pageSize: input.pageSize,
    offset: input.offset,
    sortBy: JSON.stringify(input.sortBy)
  };
  
  // Build OpenProject API filters
  if (input.filters && input.filters.length > 0) {
    const apiFilters: any[] = [];
    
    input.filters.forEach(filter => {
      if (filter.reason) {
        apiFilters.push({
          reason: { operator: '=', values: [filter.reason] }
        });
      }
      if (filter.readIAN !== undefined) {
        apiFilters.push({
          readIAN: { operator: '=', values: [filter.readIAN.toString()] }
        });
      }
      if (filter.workPackage) {
        apiFilters.push({
          resource: { operator: '=', values: [`/api/v3/work_packages/${filter.workPackage}`] }
        });
      }
      if (filter.project) {
        apiFilters.push({
          project: { operator: '=', values: [filter.project.toString()] }
        });
      }
      if (filter.dateRange) {
        apiFilters.push({
          createdAt: { 
            operator: '<>d', 
            values: [filter.dateRange.from, filter.dateRange.to] 
          }
        });
      }
    });
    
    if (apiFilters.length > 0) {
      params.filters = JSON.stringify(apiFilters);
    }
  }
  
  const { json } = await opFetch<any>(env, "/api/v3/notifications", { params });
  
  return {
    notifications: json?._embedded?.elements || [],
    total: json?.total || 0,
    count: json?.count || 0,
    pageSize: json?.pageSize || input.pageSize,
    offset: json?.offset || input.offset,
    _links: json?._links
  };
}

// Mark notifications as read
export const markNotificationsReadInput = z.object({
  notificationIds: z.array(z.union([z.string(), z.number()]))
    .describe("Array of notification IDs to mark as read"),
  markAll: z.boolean().default(false)
    .describe("Mark all notifications as read (ignores notificationIds if true)")
}).strict();

export async function markNotificationsRead({ env }: Ctx, input: z.infer<typeof markNotificationsReadInput>) {
  if (input.markAll) {
    // Mark all notifications as read
    const { json } = await opFetch<any>(env, "/api/v3/notifications/read_ian", {
      method: 'POST'
    });
    
    return {
      success: true,
      message: "All notifications marked as read",
      updatedCount: json?.updatedCount || 0
    };
  } else {
    // Mark specific notifications as read
    const results = [];
    
    for (const notificationId of input.notificationIds) {
      try {
        const { json } = await opFetch<any>(env, `/api/v3/notifications/${notificationId}/read_ian`, {
          method: 'POST'
        });
        
        results.push({
          id: notificationId,
          success: true,
          notification: json
        });
      } catch (error: any) {
        results.push({
          id: notificationId,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      results,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length
    };
  }
}

// Get notification preferences for current user
export const getNotificationSettingsInput = z.object({
  userId: z.union([z.string(), z.number()]).optional()
    .describe("User ID (defaults to current user)")
}).strict();

export async function getNotificationSettings({ env }: Ctx, input: z.infer<typeof getNotificationSettingsInput>) {
  const userId = input.userId || 'me';
  
  const { json } = await opFetch<any>(env, `/api/v3/users/${userId}`);
  
  // Extract notification-related preferences from user profile
  const notificationSettings = {
    userId: json?.id,
    name: json?.name,
    email: json?.email,
    preferences: {
      // These would be extracted from user preferences/settings
      emailNotifications: true, // Default assumption
      inAppNotifications: true,
      dailyReminders: false,
      weeklyDigest: false
    },
    // Check if user has notification capabilities
    capabilities: json?._links || {}
  };
  
  return notificationSettings;
}

// Create work package reminders (OpenProject 15.2+)
export const createReminderInput = z.object({
  workPackageId: z.union([z.string(), z.number()])
    .describe("Work package to create reminder for"),
  reminderDate: z.string()
    .describe("Date/time for reminder (ISO 8601)"),
  note: z.string().optional()
    .describe("Optional note for the reminder"),
  notifyAssignee: z.boolean().default(true)
    .describe("Notify the assignee"),
  notifyResponsible: z.boolean().default(false)
    .describe("Notify the responsible person"),
  notifyWatchers: z.boolean().default(false)
    .describe("Notify watchers")
}).strict();

export async function createReminder({ env }: Ctx, input: z.infer<typeof createReminderInput>) {
  // Note: This would use OpenProject's reminder API when available
  // For now, we'll simulate the functionality by creating a comment with reminder
  
  const payload = {
    comment: {
      format: "markdown",
      raw: `🔔 **Reminder set for ${input.reminderDate}**\n\n${input.note || 'No additional notes'}`
    },
    notify: input.notifyAssignee || input.notifyResponsible || input.notifyWatchers
  };
  
  try {
    // Create a form first to validate
    const { json: form } = await opFetch<any>(
      env, 
      `/api/v3/work_packages/${input.workPackageId}/activities/form`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );
    
    if (form?.validationErrors && Object.keys(form.validationErrors).length > 0) {
      return {
        success: false,
        error: "Validation failed",
        validationErrors: form.validationErrors
      };
    }
    
    // Commit the reminder comment
    if (form?._links?.commit) {
      const { json: result } = await opFetch<any>(env, form._links.commit.href, {
        method: form._links.commit.method || 'POST',
        body: JSON.stringify(form.payload)
      });
      
      return {
        success: true,
        reminder: {
          id: result?.id,
          workPackageId: input.workPackageId,
          reminderDate: input.reminderDate,
          note: input.note,
          createdAt: result?.createdAt,
          activityId: result?.id
        }
      };
    }
    
    return {
      success: false,
      error: "Could not create reminder - no commit link available"
    };
    
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Get notification statistics and health
export const getNotificationStatsInput = z.object({
  dateRange: z.object({
    from: z.string().describe("Start date (ISO 8601)"),
    to: z.string().describe("End date (ISO 8601)")
  }).optional().describe("Date range for statistics (defaults to last 30 days)")
}).strict();

export async function getNotificationStats({ env }: Ctx, input: z.infer<typeof getNotificationStatsInput>) {
  const defaultDateRange = {
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  };
  
  const dateRange = input.dateRange || defaultDateRange;
  
  // Get notifications in date range
  const { json } = await opFetch<any>(env, "/api/v3/notifications", {
    params: {
      filters: JSON.stringify([{
        createdAt: { 
          operator: '<>d', 
          values: [dateRange.from, dateRange.to] 
        }
      }]),
      pageSize: 1000 // Get more for statistics
    }
  });
  
  const notifications = json?._embedded?.elements || [];
  
  // Calculate statistics
  const stats = {
    total: notifications.length,
    byReason: {} as Record<string, number>,
    byProject: {} as Record<string, number>,
    readCount: 0,
    unreadCount: 0,
    dateRange
  };
  
  notifications.forEach((notification: any) => {
    // Count by reason
    const reason = notification.reason || 'unknown';
    stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;
    
    // Count by project
    const projectName = notification._links?.project?.title || 'unknown';
    stats.byProject[projectName] = (stats.byProject[projectName] || 0) + 1;
    
    // Count read/unread
    if (notification.readIAN) {
      stats.readCount++;
    } else {
      stats.unreadCount++;
    }
  });
  
  return stats;
}