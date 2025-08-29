// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
  removeDependency, removeDependencyInput
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
  if (isFieldMap) return schema as Record<string, z.ZodTypeAny>;

  // z.object(...) -> extract its shape
  if (schema?.safeParse) {
    const def = (schema as z.AnyZodObject)._def as any;
    const shape =
      typeof def?.shape === "function" ? def.shape() :
      (schema as any).shape ??
      undefined;
    if (shape && typeof shape === "object") return shape as Record<string, z.ZodTypeAny>;
  }

  throw new Error("tool(): `schema` must be a Zod object or a record of Zod fields.");
}

// Pretty-printer for the text content block
const toPretty = (v: unknown) => {
  if (typeof v === "string") return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
};

// Modern registerTool wrapper that:
//  - always supplies a field-map inputSchema (SDK-friendly across versions)
//  - returns { content: [...], structuredContent } on success
//  - returns { isError: true, ... } on failure
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

      try {
        // ✅ pass TWO args to your handlers: (ctx, input)
        const typedInput = input as InferInput<T>;
        const result = await handler({ env }, typedInput);

        return {
          content: [{ type: "text", text: toPretty(result) }],
          structuredContent: result,
        };
      } catch (e: any) {
        const status = e?.status ?? e?.code ?? undefined;
        const body = e?.body ?? undefined;
        const msg = e?.message ? String(e.message) : "Tool execution failed";
        const errJson = { message: msg, status, body };
        return {
          content: [{ type: "text", text: `Error: ${msg}\n${toPretty(errJson)}` }],
          structuredContent: errJson,
          isError: true,
        };
      }
    },
  );
}

export function buildServer() {
  const server = new McpServer({
    name: "openproject-mcp",
    version: "2.0.0", // Phase 2: Advanced PM Capabilities
    // instructions: "Comprehensive enterprise project management tools with portfolio, risk, predictive analytics, and program management."
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

  return server;
}
