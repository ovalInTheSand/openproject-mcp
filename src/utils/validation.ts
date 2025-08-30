// src/utils/validation.ts - Input validation utilities for MCP tools

import { z } from "zod";

/**
 * Common validation schemas for reuse across tools
 */
export const CommonSchemas = {
  // Basic ID validation
  id: z.number().int().positive(),
  optionalId: z.number().int().positive().optional(),
  
  // String validation
  nonEmptyString: z.string().min(1, "Cannot be empty"),
  optionalString: z.string().optional(),
  
  // Pagination
  pageSize: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
  
  // Common OpenProject fields
  subject: z.string().min(1, "Subject is required").max(255, "Subject too long"),
  description: z.string().optional(),
  lockVersion: z.number().int().min(0),
  
  // Date validation
  isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
  optionalIsoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format").optional(),
  
  // Boolean with string conversion
  booleanString: z.union([
    z.boolean(),
    z.string().transform(val => val.toLowerCase() === "true")
  ]).default(false),
  
  // Dry run parameter (common in many tools)
  dryRun: z.boolean().default(false),
};

/**
 * Validation for OpenProject filters
 */
export const filterSchema = z.record(
  z.string(),
  z.object({
    operator: z.string(),
    values: z.array(z.string())
  })
);

/**
 * Validation for sorting parameters
 */
export const sortSchema = z.array(z.object({
  field: z.string(),
  direction: z.enum(["asc", "desc"]).default("asc")
})).optional();

/**
 * Project creation/update validation
 */
export const projectDataSchema = z.object({
  name: CommonSchemas.nonEmptyString,
  identifier: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/, 
    "Identifier must contain only lowercase letters, numbers, underscores, and hyphens"),
  description: CommonSchemas.optionalString,
  homepage: z.string().url().optional(),
  public: CommonSchemas.booleanString,
  parentId: CommonSchemas.optionalId,
  status: z.enum(["active", "archived", "closed"]).optional(),
});

/**
 * Work package creation/update validation
 */
export const workPackageDataSchema = z.object({
  subject: CommonSchemas.subject,
  description: CommonSchemas.optionalString,
  typeId: CommonSchemas.id,
  statusId: CommonSchemas.optionalId,
  priorityId: CommonSchemas.optionalId,
  assigneeId: CommonSchemas.optionalId,
  responsibleId: CommonSchemas.optionalId,
  versionId: CommonSchemas.optionalId,
  parentId: CommonSchemas.optionalId,
  startDate: CommonSchemas.optionalIsoDate,
  dueDate: CommonSchemas.optionalIsoDate,
  estimatedTime: z.string().optional(),
  percentDone: z.number().int().min(0).max(100).optional(),
  // Custom fields (flexible)
  customFields: z.record(z.string(), z.any()).optional(),
});

/**
 * Time entry validation
 */
export const timeEntryDataSchema = z.object({
  workPackageId: CommonSchemas.id,
  projectId: CommonSchemas.optionalId,
  hours: z.number().positive().max(24, "Cannot log more than 24 hours"),
  comment: CommonSchemas.optionalString,
  spentOn: CommonSchemas.isoDate,
  activityId: CommonSchemas.optionalId,
});

/**
 * User search validation
 */
export const userSearchSchema = z.object({
  q: CommonSchemas.optionalString,
  status: z.enum(["active", "locked", "invited", "registered"]).optional(),
  pageSize: CommonSchemas.pageSize,
  offset: CommonSchemas.offset,
});

/**
 * File attachment validation
 */
export const attachmentSchema = z.object({
  workPackageId: CommonSchemas.id,
  fileName: CommonSchemas.nonEmptyString,
  description: CommonSchemas.optionalString,
  dataBase64: z.string().min(1, "File data is required"),
});

/**
 * Validation helper functions
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validate and transform input using a Zod schema
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  context?: string
): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      if (!firstIssue) {
        throw new ValidationError("Unknown validation error", "", "unknown");
      }
      const field = firstIssue.path.join(".");
      const message = `${field ? `${field}: ` : ""}${firstIssue.message}`;
      throw new ValidationError(
        context ? `${context}: ${message}` : message,
        field,
        firstIssue.code
      );
    }
    throw error;
  }
}

/**
 * Validate ID parameter (common use case)
 */
export function validateId(value: unknown, fieldName = "id"): number {
  return validateInput(
    CommonSchemas.id,
    value,
    `Invalid ${fieldName}`
  );
}

/**
 * Validate pagination parameters
 */
export function validatePagination(input: any): {
  pageSize: number;
  offset: number;
} {
  const result = validateInput(
    z.object({
      pageSize: CommonSchemas.pageSize,
      offset: CommonSchemas.offset,
    }),
    input || {},
    "Pagination parameters"
  );
  
  return {
    pageSize: result.pageSize || 100,
    offset: result.offset || 0
  };
}

/**
 * Validate environment variables
 */
export function validateEnvironment(env: any): {
  OP_BASE_URL: string;
  OP_TOKEN: string;
  ALLOWED_ORIGINS?: string;
} {
  const schema = z.object({
    OP_BASE_URL: z.string().url("Must be a valid URL"),
    OP_TOKEN: z.string().min(1, "API token is required"),
    ALLOWED_ORIGINS: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    SENTRY_TRACES_SAMPLE_RATE: z.string().optional(),
    SENTRY_SEND_PII: z.string().optional(),
    SENTRY_ENABLE_LOGS: z.string().optional(),
  });

  const result = validateInput(
    schema,
    env,
    "Environment configuration"
  );

  return {
    OP_BASE_URL: result.OP_BASE_URL,
    OP_TOKEN: result.OP_TOKEN,
    ALLOWED_ORIGINS: result.ALLOWED_ORIGINS
  };
}

/**
 * Sanitize HTML content (basic)
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "");
}

/**
 * Validate and sanitize description fields
 */
export function sanitizeDescription(description?: string): string | undefined {
  if (!description) {return undefined;}
  
  const trimmed = description.trim();
  return trimmed ? sanitizeHtml(trimmed) : undefined;
}