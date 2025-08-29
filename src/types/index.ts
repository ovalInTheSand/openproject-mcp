// src/types/index.ts - Centralized type definitions for OpenProject MCP Server

// Environment configuration types
export interface Env {
  OP_BASE_URL: string;
  OP_TOKEN: string;
  ALLOWED_ORIGINS?: string;
  SENTRY_DSN?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
  SENTRY_SEND_PII?: string;
  SENTRY_ENABLE_LOGS?: string;
  OP_ALLOW_INSECURE_HTTP?: string;
}

// Context types for tool handlers
export interface OpContext {
  env: Env;
}

// OpenProject API response types
export type OpCollectionMeta = {
  total?: number;
  count?: number;
  pageSize?: number;
  offset?: number;
  nextOffset?: number | null;
};

// Common API structures
export interface OpApiResponse<T = any> {
  res: Response;
  json: T;
}

export interface OpHalResource {
  _type: string;
  _links: {
    self: { href: string };
    [key: string]: { href: string; title?: string };
  };
  _embedded?: {
    [key: string]: any;
  };
  id?: number;
  subject?: string;
  description?: { raw: string; html: string };
  createdAt?: string;
  updatedAt?: string;
}

// Work Package types
export interface WorkPackage extends OpHalResource {
  _type: "WorkPackage";
  subject: string;
  description: { raw: string; html: string };
  status: OpHalResource;
  priority: OpHalResource;
  type: OpHalResource;
  project: OpHalResource;
  assignee?: OpHalResource;
  responsible?: OpHalResource;
  percentDone?: number;
  estimatedTime?: string;
  spentTime?: string;
  remainingTime?: string;
  startDate?: string;
  dueDate?: string;
  lockVersion: number;
}

// Project types
export interface Project extends OpHalResource {
  _type: "Project";
  name: string;
  identifier: string;
  description: { raw: string; html: string };
  status: "active" | "archived" | "closed";
  public: boolean;
  parent?: OpHalResource;
  statusExplanation?: { raw: string; html: string };
}

// User types
export interface User extends OpHalResource {
  _type: "User";
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  login: string;
  admin: boolean;
  avatar: string;
  status: "active" | "locked" | "invited" | "registered";
}

// Error response types
export interface OpErrorResponse {
  _type: "Error";
  errorIdentifier: string;
  message: string;
  details?: any;
}

// MCP Tool response types
export interface ToolResponse {
  content: Array<{
    type: "text" | "resource_link";
    text?: string;
    uri?: string;
  }>;
  _meta?: {
    structuredContent?: any;
  };
  isError?: boolean;
}

// Form validation types (for OpenProject forms-first approach)
export interface OpForm {
  _type: "Form";
  _embedded: {
    payload: any;
    schema: any;
    validationErrors?: any;
  };
  _links: {
    self: { href: string };
    validate: { href: string; method: string };
    commit?: { href: string; method: string };
  };
}

// Query and filtering types
export interface OpFilter {
  [key: string]: {
    operator: string;
    values: string[];
  };
}

export interface OpQuery {
  filters: OpFilter[];
  sortBy: Array<{
    field: string;
    direction: "asc" | "desc";
  }>;
  groupBy?: string;
  columns?: string[];
  displaySums?: boolean;
  publicQuery?: boolean;
  hidden?: boolean;
}

// Enterprise feature types (for advanced project management)
export interface EnterpriseMetadata {
  portfolioId?: number;
  programId?: number;
  riskLevel?: "low" | "medium" | "high" | "critical";
  complianceFramework?: string[];
  customFields?: Record<string, any>;
  governance?: {
    approvalRequired: boolean;
    reviewers: number[];
    auditTrail: boolean;
  };
}

// Attachment types
export interface Attachment extends OpHalResource {
  _type: "Attachment";
  fileName: string;
  fileSize: number;
  contentType: string;
  description: { raw: string; html: string };
  author: OpHalResource;
  digest: {
    algorithm: string;
    hash: string;
  };
  downloads: number;
}

// Time entry types
export interface TimeEntry extends OpHalResource {
  _type: "TimeEntry";
  hours: number;
  comment: { raw: string; html: string };
  spentOn: string;
  user: OpHalResource;
  workPackage: OpHalResource;
  project: OpHalResource;
  activity: OpHalResource;
}

// Version/Milestone types
export interface Version extends OpHalResource {
  _type: "Version";
  name: string;
  description: { raw: string; html: string };
  status: "open" | "locked" | "closed";
  sharing: "none" | "descendants" | "hierarchy" | "tree" | "system";
  startDate?: string;
  dueDate?: string;
  project: OpHalResource;
}