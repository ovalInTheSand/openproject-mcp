// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMetricsSnapshot, observeToolLatency, recordToolCall, recordScopeDenied } from './observability/metrics.js';
import { VERSION } from "./constants/version";
import { z } from "zod";
import {
  listProjects,
  listProjectsInput,
  listTypes,
  listTypesInput,
  listWorkPackages,
  listWPsInput,
  createWorkPackageViaForm,
  createWPInput,
  updateWorkPackage,
  updateWPInput,
  listQueries,
  listQueriesInput,
  runQuery,
  runQueryInput,
  attachToWorkPackage,
  attachInput,
} from "./tools";

// Import new tool modules
import { healthCheck, healthCheckInput } from "./tools/health";
import { listStatuses, listStatusesInput } from "./tools/statuses";
import { listPriorities, listPrioritiesInput } from "./tools/priorities";
import { listVersions, listVersionsInput } from "./tools/versions";
import { searchUsers, searchUsersInput, getCurrentUser, getCurrentUserInput } from "./tools/users";

// Import enhanced notification tools
import { 
  listNotifications, listNotificationsInput,
  markNotificationsRead, markNotificationsReadInput,
  getNotificationSettings, getNotificationSettingsInput,
  createReminder, createReminderInput,
  getNotificationStats, getNotificationStatsInput
} from "./tools/notifications";

// Import enhanced comments tools
import {
  checkCommentCapabilities, checkCommentCapabilitiesInput,
  addInternalComment, addInternalCommentInput,
  listComments, listCommentsInput,
  updateComment, updateCommentInput,
  deleteComment, deleteCommentInput
} from "./tools/comments";

// Import webhooks tools
import {
  createWebhook, createWebhookInput,
  listWebhooks, listWebhooksInput,
  updateWebhook, updateWebhookInput,
  deleteWebhook, deleteWebhookInput,
  testWebhook, testWebhookInput,
  getWebhookLogs, getWebhookLogsInput,
  validateWebhookSignature, validateWebhookSignatureInput
} from "./tools/webhooks";

// Import enterprise tool modules
import { 
  createProject, createProjectInput,
  updateProject, updateProjectInput,
  archiveProject, archiveProjectInput,
  listProjectsEnterprise, listProjectsEnterpriseInput 
} from "./tools/projects";

import {
  createWorkPackageEnterprise, createWorkPackageEnterpriseInput,
  updateWorkPackageEnterprise, updateWorkPackageEnterpriseInput,
  listWorkPackagesEnterprise, listWorkPackagesEnterpriseInput
} from "./tools/workPackagesEnterprise";

import {
  logTimeEntryEnterprise, logTimeEntryEnterpriseInput,
  updateTimeEntryEnterprise, updateTimeEntryEnterpriseInput,
  generateTimesheet, generateTimesheetInput,
  allocateResource, allocateResourceInput,
  generateResourceUtilization, generateResourceUtilizationInput
} from "./tools/timeTrackingEnterprise";

import {
  createMilestoneEnterprise, createMilestoneEnterpriseInput,
  updateMilestoneEnterprise, updateMilestoneEnterpriseInput,
  processPhaseGate, processPhaseGateInput,
  getMilestoneProgress, getMilestoneProgressInput
} from "./tools/milestonesEnterprise";

import {
  createDependency, createDependencyInput,
  updateDependency, updateDependencyInput,
  analyzeDependencies, analyzeDependenciesInput,
  removeDependency, removeDependencyInput,
  manageRelationStructure, manageRelationStructureInput
} from "./tools/dependenciesEnterprise";

import {
  generateEarnedValue, generateEarnedValueInput,
  generateCriticalPath, generateCriticalPathInput,
  generateProjectDashboard, generateProjectDashboardInput
} from "./tools/reportingEnterprise";

// Import Phase 2 Advanced PM tool modules
import {
  createPortfolio, createPortfolioInput,
  listProjectsPortfolio, listProjectsPortfolioInput,
  balanceResources, balanceResourcesInput,
  generateHealthDashboard, generateHealthDashboardInput,
  trackBenefits, trackBenefitsInput
} from "./tools/portfolioManagement";

import {
  createRiskRegister, createRiskRegisterInput,
  performQuantitativeAnalysis, performQuantitativeAnalysisInput,
  trackMitigation, trackMitigationInput,
  generateRiskBurndown, generateRiskBurndownInput
} from "./tools/riskManagement";

import {
  predictProjectSuccess, predictProjectSuccessInput,
  recommendActions, recommendActionsInput,
  benchmarkPerformance, benchmarkPerformanceInput
} from "./tools/predictiveAnalytics";

import {
  createProgram, createProgramInput,
  coordinateDeliveries, coordinateDeliveriesInput,
  trackProgramBenefits, trackProgramBenefitsInput,
  manageProgramStakeholders, manageProgramStakeholdersInput
} from "./tools/programManagement";

// Import hybrid tools for v3.0.0 dynamic PMO functionality
import {
  getProjectData, getProjectDataInput,
  getProjectStatus, getProjectStatusInput,
  getPortfolioAnalytics, getPortfolioAnalyticsInput,
  getProjectVariables, getProjectVariablesInput,
  setProjectVariables, setProjectVariablesInput,
  getOrganizationalDefaults, getOrganizationalDefaultsInput,
  setOrganizationalDefaults, setOrganizationalDefaultsInput,
  getUserVariables, getUserVariablesInput,
  getMultipleProjectsData, getMultipleProjectsDataInput,
  getCachePerformance, getCachePerformanceInput,
  clearProjectCache, clearProjectCacheInput,
  warmCache, warmCacheInput,
  exportProjectVariables, exportProjectVariablesInput,
  analyzeEVMWithBenchmark, analyzeEVMWithBenchmarkInput,
  getSystemHealth, getSystemHealthInput
} from "./tools/hybridTools";

// ---------- helper types ----------
type InferInput<T> =
  T extends z.AnyZodObject
    ? z.infer<T>
    : T extends Record<string, z.ZodTypeAny>
      ? z.infer<z.ZodObject<T>>
      : never;

// Convert z.object(...) -> raw field map, or pass through a field map
function toFieldMap(schema: any): Record<string, z.ZodTypeAny> {
  // Already a field map?
  const isFieldMap =
    schema &&
    typeof schema === "object" &&
    !schema?.safeParse &&
    Object.values(schema).every((v) => typeof (v as any)?.safeParse === "function");
  if (isFieldMap) {return schema as Record<string, z.ZodTypeAny>;}

  // z.object(...) -> extract its shape
  if (schema?.safeParse) {
    const def = (schema as z.AnyZodObject)._def as any;
    const shape =
      typeof def?.shape === "function" ? def.shape() :
      (schema as any).shape ??
      undefined;
    if (shape && typeof shape === "object") {return shape as Record<string, z.ZodTypeAny>;}
  }

  throw new Error("tool(): `schema` must be a Zod object or a record of Zod fields.");
}

// Pretty-printer for the text content block
const toPretty = (v: unknown) => {
  if (typeof v === "string") {return v;}
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
};

// Modern registerTool wrapper that:
//  - always supplies a field-map inputSchema (SDK-friendly across versions)
//  - returns { content: [...], structuredContent } on success
//  - returns { isError: true, ... } on failure
// Tool execution timeout helper
async function withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
  let timer: any;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`tool_timeout: ${name} exceeded ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Basic RBAC: env.MCP_TOOL_SCOPES = JSON string: { "tool.name": ["scopeA"], "*": ["defaultScope"] }
function resolveScopes(env: any): Record<string,string[]> {
  try {
    const raw = env?.MCP_TOOL_SCOPES; if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') { return parsed; }
  } catch {}
  return {};
}

function hasRequiredScopes(tool: string, env: any, provided: string[]|undefined): true | string {
  const map = resolveScopes(env);
  const required = map[tool] || map['*'];
  if (!required || !required.length) return true;
  const p = new Set((provided||[]).map(s=>s.toLowerCase()));
  const missing = required.filter(r=>!p.has(r.toLowerCase()));
  return missing.length ? missing.join(',') : true;
}

function registerToolHelper<
  T extends z.AnyZodObject | Record<string, z.ZodTypeAny>
>(
  server: McpServer,
  name: string,
  description: string,
  schema: T,
  // NOTE: your tool handlers in tools.ts expect (ctx, input) — two args.
  handler: (ctx: { env: any }, input: InferInput<T>) => Promise<any>,
) {
  const inputFieldMap = toFieldMap(schema);

  (server as any).registerTool(
    name,
    {
      title: name,
      description,
      inputSchema: inputFieldMap as any, // SDK builds a Zod object from this
    },
    async (input: any, extra?: { requestInfo?: any }) => {
      const env =
        extra?.requestInfo?.env ??
        (globalThis as any)?.ENV ??
        {};
      // Scopes provided by client via header 'x-mcp-scopes' (comma list) if allowed
      let providedScopes: string[]|undefined;
      try { const h = extra?.requestInfo?.req?.headers?.get?.('x-mcp-scopes'); if (h) { providedScopes = h.split(',').map((s:string)=>s.trim()).filter(Boolean); } } catch {}
      const scopeCheck = hasRequiredScopes(name, env, providedScopes);
      if (scopeCheck !== true) {
        recordScopeDenied(String(scopeCheck), name);
        return { isError:true, structuredContent:{ code:'forbidden', message:`Missing required scopes: ${scopeCheck}` }, content:[{ type:'text', text:`Error: Missing required scopes: ${scopeCheck}` }] };
      }

      try {
        const typedInput = input as InferInput<T>;
        const execTimeout = perToolTimeout(name, env);
        const t0 = Date.now();
        const ac = new AbortController();
        // Expose signal for downstream fetches
        (env as any).MCP_ABORT_SIGNAL = ac.signal;
        const timer = setTimeout(()=>{ try { ac.abort(); } catch {} }, execTimeout);
        let result: any;
        try {
          result = await handler({ env }, typedInput);
        } finally { clearTimeout(timer); delete (env as any).MCP_ABORT_SIGNAL; }
        observeToolLatency(name, Date.now() - t0);
        recordToolCall(name, 'success');
  return {
          content: [{ type: "text", text: toPretty(result) }],
          structuredContent: result,
        };
      } catch (e: any) {
        const isTimeout = /tool_timeout/.test(e?.message || '');
        recordToolCall(name, isTimeout ? 'timeout' : 'error');
        const status = e?.status ?? e?.code ?? undefined;
        const body = e?.body ?? undefined;
        const msg = e?.message ? String(e.message) : "Tool execution failed";
        const code = isTimeout ? 'tool_timeout' : (e?.code || 'upstream_error');
        const redact = (obj: any) => {
          if (!obj || typeof obj !== 'object') {return obj;}
          const shallow: any = Array.isArray(obj) ? [] : {};
          for (const [k,v] of Object.entries(obj)) {
            if (/auth|token|secret|password/i.test(k)) {shallow[k] = '[redacted]';}
            else {shallow[k] = v;}
          }
          return shallow;
        };
        const errJson = { code, message: msg, status, body: redact(body) };
        return {
          content: [{ type: "text", text: `Error: ${msg}\n${toPretty(errJson)}` }],
          structuredContent: errJson,
          isError: true,
        };
      }
    },
  );
}

function perToolTimeout(tool: string, env: any): number {
  const base = parseInt(env?.MCP_TOOL_TIMEOUT_MS || '15000', 10) || 15000;
  const raw = env?.MCP_TOOL_TIMEOUT_MAP;
  if (!raw) {return base;}
  try {
    const map = JSON.parse(raw);
    const v = map[tool];
    if (Number.isFinite(v) && v > 0 && v <= 60000) {return v;}
  } catch {}
  return base;
}

export function buildServer() {
  const server = new McpServer({
    name: "openproject-mcp",
    version: VERSION,
  });

  // Health check
  registerToolHelper(server, "op.health",
    "Check OpenProject connectivity and authentication.",
    healthCheckInput,
    healthCheck,
  );

  // Projects
  registerToolHelper(server, "projects.list",
    "List OpenProject projects (optional substring filter).",
    listProjectsInput,
    listProjects,
  );

  // Types
  registerToolHelper(server, "types.list",
    "Return work package types available in a project (or globally when projectId omitted).",
    listTypesInput,
    listTypes,
  );

  // Work packages
  registerToolHelper(server, "wp.list",
    "List work packages in a project. Supports subject~ and status filtering.",
    listWPsInput,
    listWorkPackages,
  );

  registerToolHelper(server, "wp.create",
    "Create via /form + commit. Required: projectId, typeId, subject. Optional: description, statusId, assignedToId, startDate, dueDate. Set dryRun=true to validate only.",
    createWPInput,
    createWorkPackageViaForm,
  );

  registerToolHelper(server, "wp.update",
    "Update a work package by id using lockVersion. Set dryRun=true to validate via form without committing.",
    updateWPInput,
    updateWorkPackage,
  );

  // Saved queries
  registerToolHelper(server, "queries.list",
    "List saved queries (optionally filter by projectId or name substring).",
    listQueriesInput,
    listQueries,
  );

  registerToolHelper(server, "queries.run",
    "Run a saved query by id. You may override filters/sortBy/pageSize/offset.",
    runQueryInput,
    runQuery,
  );

  // Attachments
  registerToolHelper(server, "wp.attach",
    "Attach a file (base64) to a work package using multipart/form-data.",
    attachInput,
    attachToWorkPackage,
  );

  // Statuses
  registerToolHelper(server, "statuses.list",
    "List work package statuses (global or per-project).",
    listStatusesInput,
    listStatuses,
  );

  // Priorities
  registerToolHelper(server, "priorities.list",
    "List work package priorities (global or per-project).",
    listPrioritiesInput,
    listPriorities,
  );

  // Versions
  registerToolHelper(server, "versions.list",
    "List project versions/milestones.",
    listVersionsInput,
    listVersions,
  );

  // Users
  registerToolHelper(server, "users.search",
    "Search users by name/login (empty query returns all users).",
    searchUsersInput,
    searchUsers,
  );

  registerToolHelper(server, "users.me",
    "Get current authenticated user info.",
    getCurrentUserInput,
    getCurrentUser,
  );

  // Enhanced Notifications (OpenProject 2024-2025 features)
  registerToolHelper(server, "notifications.list",
    "List notifications with enhanced filtering by reason, project, date range, and read status.",
    listNotificationsInput,
    listNotifications,
  );

  registerToolHelper(server, "notifications.markRead",
    "Mark specific notifications or all notifications as read.",
    markNotificationsReadInput,
    markNotificationsRead,
  );

  registerToolHelper(server, "notifications.getSettings",
    "Get notification preferences and capabilities for a user.",
    getNotificationSettingsInput,
    getNotificationSettings,
  );

  registerToolHelper(server, "notifications.createReminder",
    "Create work package reminders with notification options (OpenProject 15.2+).",
    createReminderInput,
    createReminder,
  );

  registerToolHelper(server, "notifications.getStats",
    "Get notification statistics and analytics for a date range.",
    getNotificationStatsInput,
    getNotificationStats,
  );

  // Enhanced Comments with Internal Support (OpenProject 2024-2025 features)
  registerToolHelper(server, "comments.checkCapabilities",
    "Check comment capabilities and permissions for a work package using Capabilities API.",
    checkCommentCapabilitiesInput,
    checkCommentCapabilities,
  );

  registerToolHelper(server, "comments.addInternal",
    "Add internal comment to work package with proper permission checking.",
    addInternalCommentInput,
    addInternalComment,
  );

  registerToolHelper(server, "comments.list",
    "List work package comments with internal/public filtering and permission checking.",
    listCommentsInput,
    listComments,
  );

  registerToolHelper(server, "comments.update",
    "Update/edit a comment if user has permission.",
    updateCommentInput,
    updateComment,
  );

  registerToolHelper(server, "comments.delete",
    "Delete a comment if user has permission.",
    deleteCommentInput,
    deleteComment,
  );

  // Real-time Webhooks Integration (OpenProject 2024-2025 features)
  registerToolHelper(server, "webhooks.create",
    "Create webhook for real-time OpenProject event notifications.",
    createWebhookInput,
    createWebhook,
  );

  registerToolHelper(server, "webhooks.list",
    "List configured webhooks with filtering options.",
    listWebhooksInput,
    listWebhooks,
  );

  registerToolHelper(server, "webhooks.update",
    "Update webhook configuration (URL, events, filters).",
    updateWebhookInput,
    updateWebhook,
  );

  registerToolHelper(server, "webhooks.delete",
    "Delete webhook configuration.",
    deleteWebhookInput,
    deleteWebhook,
  );

  registerToolHelper(server, "webhooks.test",
    "Test webhook delivery and connectivity.",
    testWebhookInput,
    testWebhook,
  );

  registerToolHelper(server, "webhooks.getLogs",
    "Get webhook delivery logs and performance statistics.",
    getWebhookLogsInput,
    getWebhookLogs,
  );

  registerToolHelper(server, "webhooks.validateSignature",
    "Validate incoming webhook signatures for security.",
    validateWebhookSignatureInput,
    validateWebhookSignature,
  );

  // === ENTERPRISE PROJECT MANAGEMENT TOOLS ===
  
  // Enterprise Projects
  registerToolHelper(server, "projects.create",
    "Create project with full enterprise schema (hierarchy, custom fields, governance).",
    createProjectInput,
    createProject,
  );

  registerToolHelper(server, "projects.update",
    "Update project with complete field support and enterprise metadata.",
    updateProjectInput,
    updateProject,
  );

  registerToolHelper(server, "projects.archive",
    "Archive project with reason tracking.",
    archiveProjectInput,
    archiveProject,
  );

  registerToolHelper(server, "projects.listEnterprise",
    "List projects with enterprise filtering (hierarchy, custom fields, advanced criteria).",
    listProjectsEnterpriseInput,
    listProjectsEnterprise,
  );

  // Enterprise Work Packages
  registerToolHelper(server, "wp.createEnterprise",
    "Create work packages with full scheduling, resources, and enterprise features.",
    createWorkPackageEnterpriseInput,
    createWorkPackageEnterprise,
  );

  registerToolHelper(server, "wp.updateEnterprise",
    "Update work packages with complete scheduling control and enterprise metadata.",
    updateWorkPackageEnterpriseInput,
    updateWorkPackageEnterprise,
  );

  registerToolHelper(server, "wp.listEnterprise",
    "List work packages with advanced filtering, analytics, and schedule metrics.",
    listWorkPackagesEnterpriseInput,
    listWorkPackagesEnterprise,
  );

  // Enterprise Time Tracking & Resource Management
  registerToolHelper(server, "time.logEnterprise",
    "Log time with cost accounting, billable hours, and enterprise tracking.",
    logTimeEntryEnterpriseInput,
    logTimeEntryEnterprise,
  );

  registerToolHelper(server, "time.updateEnterprise",
    "Update time entries with enterprise cost and billing features.",
    updateTimeEntryEnterpriseInput,
    updateTimeEntryEnterprise,
  );

  registerToolHelper(server, "time.generateTimesheet",
    "Generate comprehensive timesheets with analytics and cost reporting.",
    generateTimesheetInput,
    generateTimesheet,
  );

  registerToolHelper(server, "resources.allocate",
    "Allocate resources with capacity planning and cost management (MS Project style).",
    allocateResourceInput,
    allocateResource,
  );

  registerToolHelper(server, "resources.utilization",
    "Generate resource utilization reports with capacity analysis.",
    generateResourceUtilizationInput,
    generateResourceUtilization,
  );

  // Enterprise Milestone & Phase Gate Management
  registerToolHelper(server, "milestones.createEnterprise",
    "Create milestones with phase gates, approval workflows, and enterprise governance.",
    createMilestoneEnterpriseInput,
    createMilestoneEnterprise,
  );

  registerToolHelper(server, "milestones.updateEnterprise",
    "Update milestones with enterprise features and stakeholder management.",
    updateMilestoneEnterpriseInput,
    updateMilestoneEnterprise,
  );

  registerToolHelper(server, "milestones.processPhaseGate",
    "Process phase gate approvals with conditional approval and audit trail.",
    processPhaseGateInput,
    processPhaseGate,
  );

  registerToolHelper(server, "milestones.progress",
    "Get milestone progress with enterprise analytics and risk assessment.",
    getMilestoneProgressInput,
    getMilestoneProgress,
  );

  // Enterprise Dependency & Critical Path Management
  registerToolHelper(server, "dependencies.create",
    "Create dependencies with lead/lag, response modes, and enterprise risk management.",
    createDependencyInput,
    createDependency,
  );

  registerToolHelper(server, "dependencies.update",
    "Update dependencies with enterprise metadata and constraint management.",
    updateDependencyInput,
    updateDependency,
  );

  registerToolHelper(server, "dependencies.analyze",
    "Analyze dependencies with critical path calculation and risk assessment.",
    analyzeDependenciesInput,
    analyzeDependencies,
  );

  registerToolHelper(server, "dependencies.remove",
    "Remove dependencies with audit trail and impact analysis.",
    removeDependencyInput,
    removeDependency,
  );

  registerToolHelper(server, "dependencies.manageStructure",
    "Manage work package relations using OpenProject 2024-2025 two-level structure with negative lag support.",
    manageRelationStructureInput,
    manageRelationStructure,
  );

  // Enterprise Reporting & Analytics
  registerToolHelper(server, "reports.earnedValue",
    "Generate earned value management (EVM) reports with PMBOK standard calculations.",
    generateEarnedValueInput,
    generateEarnedValue,
  );

  registerToolHelper(server, "reports.criticalPath",
    "Generate critical path analysis with float calculations and schedule risk.",
    generateCriticalPathInput,
    generateCriticalPath,
  );

  registerToolHelper(server, "reports.projectDashboard",
    "Generate comprehensive project dashboard with KPIs and performance metrics.",
    generateProjectDashboardInput,
    generateProjectDashboard,
  );

  // === PHASE 2: ADVANCED PM CAPABILITIES ===
  
  // Portfolio Management
  registerToolHelper(server, "portfolio.create",
    "Create enterprise portfolio with strategic objectives, budget allocation, and project hierarchy.",
    createPortfolioInput,
    createPortfolio,
  );

  registerToolHelper(server, "portfolio.listProjects", 
    "List projects in portfolio with hierarchy, custom fields, and status information.",
    listProjectsPortfolioInput,
    listProjectsPortfolio,
  );

  registerToolHelper(server, "portfolio.balanceResources",
    "Balance resources across portfolio projects with optimization and conflict detection.",
    balanceResourcesInput,
    balanceResources,
  );

  registerToolHelper(server, "portfolio.generateHealthDashboard",
    "Generate portfolio health dashboard with KPIs, risk scores, and executive metrics.",
    generateHealthDashboardInput,
    generateHealthDashboard,
  );

  registerToolHelper(server, "portfolio.trackBenefits",
    "Track benefits realization across portfolio with projections and baseline comparison.",
    trackBenefitsInput,
    trackBenefits,
  );

  // Risk Management
  registerToolHelper(server, "risk.createRegister",
    "Create comprehensive risk register with probability, impact, and response planning.",
    createRiskRegisterInput,
    createRiskRegister,
  );

  registerToolHelper(server, "risk.performQuantitativeAnalysis",
    "Perform quantitative risk analysis using Monte Carlo, sensitivity analysis, and risk modeling.",
    performQuantitativeAnalysisInput,
    performQuantitativeAnalysis,
  );

  registerToolHelper(server, "risk.trackMitigation",
    "Track risk mitigation progress with effectiveness measurement and residual risk calculation.",
    trackMitigationInput,
    trackMitigation,
  );

  registerToolHelper(server, "risk.generateBurndown",
    "Generate risk burndown charts with trend analysis and categorical breakdown.",
    generateRiskBurndownInput,
    generateRiskBurndown,
  );

  // Predictive Analytics
  registerToolHelper(server, "analytics.predictSuccess",
    "Predict project success probability using machine learning and pattern analysis.",
    predictProjectSuccessInput,
    predictProjectSuccess,
  );

  registerToolHelper(server, "analytics.recommendActions",
    "Recommend project actions using AI analysis and optimization algorithms.",
    recommendActionsInput,
    recommendActions,
  );

  registerToolHelper(server, "analytics.benchmarkPerformance",
    "Benchmark project performance against industry standards and organizational history.",
    benchmarkPerformanceInput,
    benchmarkPerformance,
  );

  // Program Management
  registerToolHelper(server, "program.create",
    "Create enterprise program with benefit tracking, governance, and stakeholder management.",
    createProgramInput,
    createProgram,
  );

  registerToolHelper(server, "program.coordinateDeliveries",
    "Coordinate deliveries across program projects with dependency management and milestone alignment.",
    coordinateDeliveriesInput,
    coordinateDeliveries,
  );

  registerToolHelper(server, "program.trackBenefits",
    "Track program-level benefits realization with project contribution analysis and forecasting.",
    trackProgramBenefitsInput,
    trackProgramBenefits,
  );

  registerToolHelper(server, "program.manageStakeholders", 
    "Manage program stakeholders with influence mapping, engagement planning, and communication matrix.",
    manageProgramStakeholdersInput,
    manageProgramStakeholders,
  );

  // === v3.0.0 HYBRID DATA & DYNAMIC VARIABLES TOOLS ===
  
  // Hybrid Project Data Access
  registerToolHelper(server, "hybrid.getProjectData",
    "Get comprehensive project data using hybrid OpenProject native + custom calculations.",
    getProjectDataInput,
    getProjectData,
  );
  
  registerToolHelper(server, "hybrid.getProjectStatus",
    "Get real-time project status (never cached) with alerts and upcoming deadlines.",
    getProjectStatusInput,
    getProjectStatus,
  );
  
  registerToolHelper(server, "hybrid.getMultipleProjectsData",
    "Get data for multiple projects efficiently with intelligent caching.",
    getMultipleProjectsDataInput,
    getMultipleProjectsData,
  );
  
  // Portfolio Analytics
  registerToolHelper(server, "hybrid.getPortfolioAnalytics",
    "Get comprehensive portfolio analytics with resource conflicts and recommendations.",
    getPortfolioAnalyticsInput,
    getPortfolioAnalytics,
  );
  
  // PMO Variable Management
  registerToolHelper(server, "variables.getProjectVariables",
    "Get PMO variables for a specific project (combines defaults + overrides).",
    getProjectVariablesInput,
    getProjectVariables,
  );
  
  registerToolHelper(server, "variables.setProjectVariables",
    "Set PMO variables for a project with validation and policy checking.",
    setProjectVariablesInput,
    setProjectVariables,
  );
  
  registerToolHelper(server, "variables.getOrganizationalDefaults",
    "Get organizational default PMO variables.",
    getOrganizationalDefaultsInput,
    getOrganizationalDefaults,
  );
  
  registerToolHelper(server, "variables.setOrganizationalDefaults",
    "Set organizational default PMO variables.",
    setOrganizationalDefaultsInput,
    setOrganizationalDefaults,
  );
  
  registerToolHelper(server, "variables.getUserVariables",
    "Get user-specific variables (rates, preferences, skill level, etc.).",
    getUserVariablesInput,
    getUserVariables,
  );
  
  registerToolHelper(server, "variables.export",
    "Export PMO variables for backup or migration purposes.",
    exportProjectVariablesInput,
    exportProjectVariables,
  );
  
  // Cache Management
  registerToolHelper(server, "cache.getPerformance",
    "Get cache performance statistics and health information.",
    getCachePerformanceInput,
    getCachePerformance,
  );
  
  registerToolHelper(server, "cache.clearProject",
    "Clear cached data for a specific project.",
    clearProjectCacheInput,
    clearProjectCache,
  );
  
  registerToolHelper(server, "cache.warm",
    "Pre-warm cache for frequently accessed projects.",
    warmCacheInput,
    warmCache,
  );
  
  // Enhanced Analytics
  registerToolHelper(server, "analytics.evmWithBenchmark",
    "Analyze EVM performance with benchmark comparison and industry standards.",
    analyzeEVMWithBenchmarkInput,
    analyzeEVMWithBenchmark,
  );
  
  // System Health
  registerToolHelper(server, "system.getHealth",
    "Get comprehensive system health including cache performance and feature status.",
    getSystemHealthInput,
    getSystemHealth,
  );

  registerToolHelper(server, 'system.getCapabilities', 'Get server capabilities, limits, and feature flags.', z.object({}), async ({ env }) => {
    const extra = (env as any)?.MCP_EGRESS_ALLOW;
    const baseHost = new URL(env.OP_BASE_URL).host;
    const allowedHosts = [baseHost, ...(extra ? String(extra).split(',').map((s)=>s.trim()).filter(Boolean) : [])];
    return {
      name: 'openproject-mcp', version: VERSION, protocolRevision: '2025-06-18',
      toolCount: (server as any).tools?.size || undefined,
      features: { sse: true, webhooks: true, hybridData: true, enterprise: true, predictiveAnalytics: true },
      limits: {
        rateLimit: parseInt((env as any)?.MCP_RATE_LIMIT || '200',10),
        rateWindowMs: parseInt((env as any)?.MCP_RATE_WINDOW_MS || '60000',10),
        maxBodyBytes: parseInt((env as any)?.MCP_MAX_BODY_BYTES || String(512*1024),10),
        defaultToolTimeoutMs: parseInt((env as any)?.MCP_TOOL_TIMEOUT_MS || '15000',10),
        sseMaxConnections: 25,
        maxArrayItems: parseInt((env as any)?.MCP_MAX_ARRAY_ITEMS || '200',10),
        maxStringLength: parseInt((env as any)?.MCP_MAX_STRING_LENGTH || '5000',10),
        maxFilters: parseInt((env as any)?.MCP_MAX_FILTERS || '25',10)
      },
      security: { rateLimiting: true, bodyLimit: true, egressAllowlist: true, timeouts: true, sseCap: true, hmacEnabled: !!(env as any)?.MCP_HMAC_SECRET, ipPrivacy: !!(env as any)?.MCP_IP_HASH_SALT },
      egress: { allowedHosts }
    };
  });

  // Tool listing (introspection) for validation/diagnostics
  registerToolHelper(server, 'system.listTools', 'List registered tool names.', z.object({}), async () => {
    let names: string[] = [];
    const raw = (server as any).tools;
    if (raw) {
      if (typeof raw.keys === 'function') {names = Array.from(raw.keys());}
      else if (Array.isArray(raw)) {names = raw.map((t: any)=>String(t?.name||''));}
      else if (typeof raw === 'object') {names = Object.keys(raw);}
    }
    names = names.filter(Boolean).sort();
    return { tools: names, count: names.length };
  });

  registerToolHelper(server, 'system.getMetrics', 'Get in-memory metrics counters.', z.object({}), async () => getMetricsSnapshot());

  return server;
}
