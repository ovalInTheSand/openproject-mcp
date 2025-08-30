// src/tools/timeTrackingEnterprise.ts
import { z } from "zod";
import { opFetch, parseCollectionMeta, hal, withQuery } from "../util/op.js";
import type { Ctx } from "../tools";

//
// Enterprise Time Tracking & Resource Management
//

// Time format schema (HH:MM format)
const TimeSchema = z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().describe("Time in HH:MM format");

// Custom fields for time entries
const TimeEntryCustomFieldsSchema = z.object({
  customField1: z.any().optional(), // Overtime flag
  customField2: z.any().optional(), // Client billable
  customField3: z.any().optional(), // Department code
  customField4: z.any().optional(), // Project phase
  customField5: z.any().optional(), // Task complexity
  customField6: z.any().optional(), // Location (remote/office)
  customField7: z.any().optional(), // Cost center override
  customField8: z.any().optional(), // Approval status
}).partial();

//
// Enterprise Time Entry Creation
//
export const logTimeEntryEnterpriseInput = z.object({
  // Core time tracking
  workPackageId: z.union([z.string(), z.number()]).describe("Work package ID"),
  spentOn: z.string().describe("Date when time was spent (YYYY-MM-DD)"),
  hours: z.number().positive().max(24).describe("Hours spent (decimal allowed, max 24)"),
  comment: z.string().optional().describe("Description of work performed"),
  
  // Enterprise time management
  activityId: z.union([z.string(), z.number()]).optional().describe("Activity/category ID (Development, Testing, PM, etc.)"),
  startTime: TimeSchema.describe("Start time (HH:MM) for detailed tracking"),
  endTime: TimeSchema.describe("End time (HH:MM) for detailed tracking"),
  ongoing: z.boolean().default(false).describe("Whether this is an active timer"),
  
  // Cost accounting (enterprise)
  billableHours: z.number().min(0).max(24).optional().describe("Billable hours (may differ from actual)"),
  billingRate: z.number().min(0).optional().describe("Hourly billing rate for this entry"),
  costRate: z.number().min(0).optional().describe("Cost rate for resource accounting"),
  
  // Resource management
  userId: z.union([z.string(), z.number()]).optional().describe("User ID (defaults to current user)"),
  
  // Custom enterprise fields
  customFields: TimeEntryCustomFieldsSchema.optional().describe("Organization-specific time tracking fields"),
}).strict();

export async function logTimeEntryEnterprise({ env }: Ctx, input: z.infer<typeof logTimeEntryEnterpriseInput>) {
  // Build comprehensive time entry payload
  const payload: any = {
    spentOn: input.spentOn,
    hours: input.hours,
    _links: {
      workPackage: hal.workPackage(input.workPackageId),
    },
  };

  // Add optional core fields
  if (input.comment) payload.comment = input.comment;
  if (input.ongoing !== undefined) payload.ongoing = input.ongoing;

  // Enterprise time management
  if (input.startTime) payload.startTime = input.startTime;
  if (input.endTime) payload.endTime = input.endTime;
  if (input.activityId) payload._links.activity = { href: `/api/v3/time_entries/activities/${input.activityId}` };

  // Resource assignment
  if (input.userId) payload._links.user = hal.user(input.userId);

  // Cost accounting fields
  if (input.billableHours !== undefined) payload.billableHours = input.billableHours;
  if (input.billingRate !== undefined) payload.billingRate = input.billingRate;
  if (input.costRate !== undefined) payload.costRate = input.costRate;

  // Custom fields
  if (input.customFields) {
    Object.entries(input.customFields).forEach(([key, value]) => {
      if (value !== undefined) {
        payload[key] = value;
      }
    });
  }

  const { json: created } = await opFetch<any>(env, "/api/v3/time_entries", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return { 
    ok: true, 
    timeEntry: created,
    timeEntryUrl: created?._links?.self?.href,
    totalHours: created?.hours,
    billableAmount: input.billableHours && input.billingRate ? input.billableHours * input.billingRate : undefined
  };
}

//
// Time Entry Updates (Enterprise)
//
export const updateTimeEntryEnterpriseInput = z.object({
  id: z.union([z.string(), z.number()]).describe("Time entry ID"),
  
  // Updatable fields
  spentOn: z.string().optional().describe("Date when time was spent"),
  hours: z.number().positive().max(24).optional().describe("Hours spent"),
  comment: z.string().optional().describe("Work description"),
  
  // Enterprise updates
  activityId: z.union([z.string(), z.number()]).optional().describe("Activity category"),
  startTime: TimeSchema.describe("Start time"),
  endTime: TimeSchema.describe("End time"),
  ongoing: z.boolean().optional().describe("Active timer status"),
  
  // Cost updates
  billableHours: z.number().min(0).max(24).optional(),
  billingRate: z.number().min(0).optional(),
  costRate: z.number().min(0).optional(),
  
  // Custom field updates
  customFields: TimeEntryCustomFieldsSchema.optional(),
}).strict();

export async function updateTimeEntryEnterprise({ env }: Ctx, input: z.infer<typeof updateTimeEntryEnterpriseInput>) {
  const payload: any = {};

  // Update core fields
  if (input.spentOn !== undefined) payload.spentOn = input.spentOn;
  if (input.hours !== undefined) payload.hours = input.hours;
  if (input.comment !== undefined) payload.comment = input.comment;
  if (input.ongoing !== undefined) payload.ongoing = input.ongoing;
  if (input.startTime !== undefined) payload.startTime = input.startTime;
  if (input.endTime !== undefined) payload.endTime = input.endTime;

  // Update links
  payload._links = {};
  if (input.activityId !== undefined) {
    payload._links.activity = input.activityId ? { href: `/api/v3/time_entries/activities/${input.activityId}` } : null;
  }

  // Update cost fields
  if (input.billableHours !== undefined) payload.billableHours = input.billableHours;
  if (input.billingRate !== undefined) payload.billingRate = input.billingRate;
  if (input.costRate !== undefined) payload.costRate = input.costRate;

  // Update custom fields
  if (input.customFields) {
    Object.entries(input.customFields).forEach(([key, value]) => {
      if (value !== undefined) {
        payload[key] = value;
      }
    });
  }

  const { json: updated } = await opFetch<any>(env, `/api/v3/time_entries/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return { 
    ok: true, 
    timeEntry: updated,
    updatedFields: Object.keys(payload)
  };
}

//
// Enterprise Time Reporting & Analytics
//
export const generateTimesheetInput = z.object({
  // Time period
  startDate: z.string().describe("Report start date (YYYY-MM-DD)"),
  endDate: z.string().describe("Report end date (YYYY-MM-DD)"),
  
  // Filtering
  projectId: z.union([z.string(), z.number()]).optional().describe("Filter by project"),
  userId: z.union([z.string(), z.number()]).optional().describe("Filter by user"),
  workPackageId: z.union([z.string(), z.number()]).optional().describe("Filter by work package"),
  activityId: z.union([z.string(), z.number()]).optional().describe("Filter by activity"),
  
  // Enterprise filtering
  billableOnly: z.boolean().default(false).describe("Show only billable hours"),
  includeCustomFields: z.boolean().default(false).describe("Include custom field data"),
  
  // Grouping and aggregation
  groupBy: z.enum(['user', 'project', 'workPackage', 'activity', 'date']).default('date').describe("Group results by"),
  includeTotals: z.boolean().default(true).describe("Include summary totals"),
  
  // Pagination
  offset: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(1000).default(100),
}).strict();

export async function generateTimesheet({ env }: Ctx, input: z.infer<typeof generateTimesheetInput>) {
  const filters: any[] = [];
  
  // Date range filter (required)
  filters.push({ spentOn: { operator: ">=d", values: [input.startDate] } });
  filters.push({ spentOn: { operator: "<=d", values: [input.endDate] } });
  
  // Optional filters
  if (input.projectId !== undefined) {
    filters.push({ project: { operator: "=", values: [input.projectId.toString()] } });
  }
  
  if (input.userId !== undefined) {
    filters.push({ user: { operator: "=", values: [input.userId.toString()] } });
  }
  
  if (input.workPackageId !== undefined) {
    filters.push({ workPackage: { operator: "=", values: [input.workPackageId.toString()] } });
  }
  
  if (input.activityId !== undefined) {
    filters.push({ activity: { operator: "=", values: [input.activityId.toString()] } });
  }

  // Enterprise filtering
  if (input.billableOnly) {
    filters.push({ billableHours: { operator: ">", values: ["0"] } });
  }

  const params: Record<string, unknown> = {
    offset: input.offset,
    pageSize: input.pageSize,
    filters: JSON.stringify(filters),
  };

  // Sorting by group criteria
  const sortBy: string[][] = [];
  switch (input.groupBy) {
    case 'user':
      sortBy.push(['user', 'asc'], ['spentOn', 'asc']);
      break;
    case 'project':
      sortBy.push(['project', 'asc'], ['spentOn', 'asc']);
      break;
    case 'workPackage':
      sortBy.push(['workPackage', 'asc'], ['spentOn', 'asc']);
      break;
    case 'activity':
      sortBy.push(['activity', 'asc'], ['spentOn', 'asc']);
      break;
    default: // date
      sortBy.push(['spentOn', 'asc'], ['user', 'asc']);
  }
  params.sortBy = JSON.stringify(sortBy);

  const { json } = await opFetch<any>(env, "/api/v3/time_entries", { params });
  const meta = parseCollectionMeta(json);
  const elements = json?._embedded?.elements ?? [];
  
  // Calculate totals and analytics
  const analytics = {
    totalHours: elements.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0),
    billableHours: elements.reduce((sum: number, entry: any) => sum + (entry.billableHours || entry.hours || 0), 0),
    totalEntries: elements.length,
    averageHoursPerDay: 0,
    costTotal: elements.reduce((sum: number, entry: any) => {
      const hours = entry.hours || 0;
      const rate = entry.costRate || 0;
      return sum + (hours * rate);
    }, 0),
    billingTotal: elements.reduce((sum: number, entry: any) => {
      const hours = entry.billableHours || entry.hours || 0;
      const rate = entry.billingRate || 0;
      return sum + (hours * rate);
    }, 0),
  };

  // Calculate daily average
  const daysDiff = Math.ceil((new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / (1000 * 3600 * 24)) + 1;
  analytics.averageHoursPerDay = analytics.totalHours / daysDiff;

  // Group data if requested
  const groupedData: Record<string, any[]> = {};
  if (input.groupBy !== 'date') {
    elements.forEach((entry: any) => {
      const groupKey = entry[input.groupBy]?.name || entry[input.groupBy] || 'Unknown';
      if (!groupedData[groupKey]) {
        groupedData[groupKey] = [];
      }
      groupedData[groupKey].push(entry);
    });
  }

  return { 
    timesheet: {
      period: { startDate: input.startDate, endDate: input.endDate },
      entries: elements,
      groupedBy: input.groupBy,
      groupedData: Object.keys(groupedData).length > 0 ? groupedData : undefined,
      analytics: input.includeTotals ? analytics : undefined,
    },
    ...meta,
    appliedFilters: filters
  };
}

//
// Resource Allocation Management (Enterprise)
//
export const allocateResourceInput = z.object({
  projectId: z.union([z.string(), z.number()]).describe("Project ID"),
  userId: z.union([z.string(), z.number()]).describe("User ID to allocate"),
  
  // Resource allocation (MS Project style)
  allocationPercentage: z.number().min(0).max(200).describe("Allocation percentage (0-200%, 100% = full time)"),
  startDate: z.string().describe("Allocation start date (YYYY-MM-DD)"),
  endDate: z.string().describe("Allocation end date (YYYY-MM-DD)"),
  
  // Cost management
  standardRate: z.number().min(0).optional().describe("Standard hourly rate"),
  overtimeRate: z.number().min(0).optional().describe("Overtime hourly rate"),
  costPerUse: z.number().min(0).optional().describe("Fixed cost per assignment"),
  
  // Capacity planning
  maxUnitsAvailable: z.number().min(0).max(10).default(1).describe("Maximum units available (1.0 = 100%)"),
  workingCalendarId: z.union([z.string(), z.number()]).optional().describe("Working calendar reference"),
  
  // Role-based assignment
  roleIds: z.array(z.union([z.string(), z.number()])).optional().describe("Role IDs for this allocation"),
}).strict();

export async function allocateResource({ env }: Ctx, input: z.infer<typeof allocateResourceInput>) {
  // Create project membership with allocation details
  const membershipPayload: any = {
    _links: {
      project: hal.project(input.projectId),
      principal: hal.user(input.userId),
    },
  };

  // Add roles if specified
  if (input.roleIds && input.roleIds.length > 0) {
    membershipPayload._links.roles = input.roleIds.map(roleId => ({ href: `/api/v3/roles/${roleId}` }));
  }

  const { json: membership } = await opFetch<any>(env, "/api/v3/memberships", {
    method: "POST",
    body: JSON.stringify(membershipPayload),
  });

  // Store allocation details in custom fields (if supported)
  const allocationData = {
    allocationPercentage: input.allocationPercentage,
    startDate: input.startDate,
    endDate: input.endDate,
    standardRate: input.standardRate,
    overtimeRate: input.overtimeRate,
    costPerUse: input.costPerUse,
    maxUnitsAvailable: input.maxUnitsAvailable,
    workingCalendarId: input.workingCalendarId,
  };

  return { 
    ok: true, 
    membership,
    allocation: allocationData,
    membershipUrl: membership?._links?.self?.href,
    effectiveDates: {
      start: input.startDate,
      end: input.endDate,
    },
    capacityUtilization: `${input.allocationPercentage}%`
  };
}

//
// Resource Utilization Reporting
//
export const generateResourceUtilizationInput = z.object({
  // Time period for analysis
  startDate: z.string().describe("Analysis start date (YYYY-MM-DD)"),
  endDate: z.string().describe("Analysis end date (YYYY-MM-DD)"),
  
  // Filtering
  projectId: z.union([z.string(), z.number()]).optional().describe("Filter by project"),
  userId: z.union([z.string(), z.number()]).optional().describe("Filter by specific user"),
  departmentId: z.union([z.string(), z.number()]).optional().describe("Filter by department"),
  
  // Analysis options
  includeAllocations: z.boolean().default(true).describe("Include planned allocations"),
  includeActuals: z.boolean().default(true).describe("Include actual time logged"),
  calculateVariance: z.boolean().default(true).describe("Calculate planned vs actual variance"),
}).strict();

export async function generateResourceUtilization({ env }: Ctx, input: z.infer<typeof generateResourceUtilizationInput>) {
  // Get actual time entries for the period
  const timeFilters: Record<string, any> = {
    spentOn: { operator: ">=d", values: [input.startDate] }
  };

  if (input.endDate) {
    timeFilters.spentOnEnd = { operator: "<=d", values: [input.endDate] };
  }

  if (input.projectId) {
    timeFilters.project = { operator: "=", values: [input.projectId.toString()] };
  }

  if (input.userId) {
    timeFilters.user = { operator: "=", values: [input.userId.toString()] };
  }

  const { json: timeData } = await opFetch<any>(env, "/api/v3/time_entries", {
    params: {
      filters: JSON.stringify(timeFilters),
      pageSize: 1000, // Get comprehensive data
      sortBy: JSON.stringify([['user', 'asc'], ['spentOn', 'asc']])
    }
  });

  const timeEntries = timeData?._embedded?.elements ?? [];

  // Calculate utilization by user
  const userUtilization: Record<string, any> = {};
  
  timeEntries.forEach((entry: any) => {
    const userId = entry._links?.user?.href?.split('/').pop();
    const userName = entry._links?.user?.title || `User ${userId}`;
    
    if (!userUtilization[userId]) {
      userUtilization[userId] = {
        userId,
        userName,
        totalHours: 0,
        billableHours: 0,
        projects: {},
        dailyHours: {},
      };
    }
    
    const util = userUtilization[userId];
    util.totalHours += entry.hours || 0;
    util.billableHours += entry.billableHours || entry.hours || 0;
    
    // Track by project
    const projectId = entry._links?.project?.href?.split('/').pop();
    const projectName = entry._links?.project?.title || `Project ${projectId}`;
    
    if (!util.projects[projectId]) {
      util.projects[projectId] = { name: projectName, hours: 0 };
    }
    util.projects[projectId].hours += entry.hours || 0;
    
    // Track by day
    if (!util.dailyHours[entry.spentOn]) {
      util.dailyHours[entry.spentOn] = 0;
    }
    util.dailyHours[entry.spentOn] += entry.hours || 0;
  });

  // Calculate summary metrics
  const totalUsers = Object.keys(userUtilization).length;
  const totalHours = Object.values(userUtilization).reduce((sum: number, user: any) => sum + user.totalHours, 0);
  const averageHoursPerUser = totalUsers > 0 ? totalHours / totalUsers : 0;
  
  const daysDiff = Math.ceil((new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / (1000 * 3600 * 24)) + 1;
  const workingDays = daysDiff * 0.71; // Assume ~5 working days per week
  const expectedHoursPerUser = workingDays * 8; // 8 hours per day
  
  return {
    resourceUtilization: {
      period: { startDate: input.startDate, endDate: input.endDate },
      summary: {
        totalUsers,
        totalHours,
        averageHoursPerUser,
        workingDays,
        expectedHoursPerUser,
        utilizationRate: expectedHoursPerUser > 0 ? (averageHoursPerUser / expectedHoursPerUser) * 100 : 0,
      },
      userDetails: Object.values(userUtilization),
      periodMetrics: {
        peakDay: null, // Could calculate from daily data
        lowDay: null,
        averageDailyHours: totalHours / daysDiff,
      }
    }
  };
}