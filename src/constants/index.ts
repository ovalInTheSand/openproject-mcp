// src/constants/index.ts - Application constants and configuration

// Application metadata
export const APP_NAME = "openproject-mcp";
export const APP_VERSION = "3.2.0"; // Aligned with package.json
export const APP_DESCRIPTION = "Professional MCP server for OpenProject API integration with enterprise project management capabilities";

// MCP Server configuration
export const MCP_SERVER_INFO = {
  name: APP_NAME,
  version: APP_VERSION,
  description: APP_DESCRIPTION,
  capabilities: {
    tools: true,
    resources: false,
    prompts: false,
  },
};

// HTTP defaults
export const DEFAULT_TIMEOUTS = {
  API_REQUEST: 30000, // 30 seconds
  CONNECTION: 10000,  // 10 seconds
} as const;

// Retry configuration
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  retryStatusCodes: [429, 500, 502, 503, 504],
  retryDelay: 1000, // Base delay in milliseconds
} as const;

// OpenProject API endpoints
export const OP_API_ENDPOINTS = {
  BASE: "/api/v3",
  HEALTH: "/api/v3",
  PROJECTS: "/api/v3/projects",
  WORK_PACKAGES: "/api/v3/work_packages",
  USERS: "/api/v3/users",
  TYPES: "/api/v3/types",
  STATUSES: "/api/v3/statuses",
  PRIORITIES: "/api/v3/priorities",
  VERSIONS: "/api/v3/versions",
  QUERIES: "/api/v3/queries",
  TIME_ENTRIES: "/api/v3/time_entries",
  ATTACHMENTS: "/api/v3/attachments",
  FORMS: "/api/v3/work_packages/form",
} as const;

// Default pagination
export const DEFAULT_PAGINATION = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  OFFSET: 0,
} as const;

// CORS configuration
export const DEFAULT_CORS_ORIGINS = [
  "https://claude.ai",
  "https://app.claude.ai",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
] as const;

// User Agent for API requests
export const USER_AGENT = `${APP_NAME}/${APP_VERSION} (+mcp)`;

// Error codes and messages
export const ERROR_CODES = {
  MISSING_ENV: "MISSING_ENVIRONMENT_VARIABLE",
  API_ERROR: "OPENPROJECT_API_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTH_ERROR: "AUTHENTICATION_ERROR",
  NOT_FOUND: "RESOURCE_NOT_FOUND",
  TIMEOUT: "REQUEST_TIMEOUT",
  NETWORK_ERROR: "NETWORK_ERROR",
} as const;

// OpenProject work package types (common defaults)
export const DEFAULT_WP_TYPES = {
  TASK: "Task",
  BUG: "Bug",
  FEATURE: "Feature",
  USER_STORY: "User story",
  EPIC: "Epic",
  MILESTONE: "Milestone",
} as const;

// OpenProject statuses (common defaults)
export const DEFAULT_STATUSES = {
  NEW: "New",
  IN_PROGRESS: "In progress", 
  ON_HOLD: "On hold",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REJECTED: "Rejected",
} as const;

// OpenProject priorities (common defaults)
export const DEFAULT_PRIORITIES = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  IMMEDIATE: "Immediate",
} as const;

// Enterprise feature flags (for your private use)
export const ENTERPRISE_FEATURES = {
  PORTFOLIO_MANAGEMENT: true,
  RISK_MANAGEMENT: true,
  PREDICTIVE_ANALYTICS: true,
  PROGRAM_MANAGEMENT: true,
  ADVANCED_REPORTING: true,
  CUSTOM_WORKFLOWS: true,
  AUDIT_TRAILS: true,
  COMPLIANCE_TRACKING: true,
} as const;

// Tool categories for organization
export const TOOL_CATEGORIES = {
  CORE: "Core Operations",
  WORKFLOW: "Workflow Support", 
  ENTERPRISE: "Enterprise Management",
  REPORTING: "Reporting & Analytics",
  PORTFOLIO: "Portfolio Management",
  RISK: "Risk Management",
  PROGRAM: "Program Management",
  PREDICTIVE: "Predictive Analytics",
} as const;

// Logging levels
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const;

// Cache configuration (if needed)
export const CACHE_CONFIG = {
  TTL_SHORT: 5 * 60,    // 5 minutes
  TTL_MEDIUM: 30 * 60,  // 30 minutes
  TTL_LONG: 60 * 60,    // 1 hour
} as const;

// Development vs Production indicators
export const ENVIRONMENT = {
  isDev: () => typeof globalThis !== "undefined" && 
    (globalThis as any).ENV?.NODE_ENV === "development",
  isProduction: () => typeof globalThis !== "undefined" && 
    (globalThis as any).ENV?.NODE_ENV === "production",
} as const;