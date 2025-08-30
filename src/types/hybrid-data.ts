// src/types/hybrid-data.ts
import { z } from "zod";

// Core hybrid data interfaces for OpenProject native + custom enterprise features

//
// Native OpenProject Data Structures (pulled from API)
//
export interface NativeWorkPackageData {
  id: string | number;
  subject: string;
  percentageDone: number;
  estimatedTime?: string; // ISO 8601 duration format
  spentTime?: string;
  startDate?: string;
  dueDate?: string;
  status: {
    id: string | number;
    name: string;
    isClosed: boolean;
  };
  type: {
    id: string | number;
    name: string;
  };
  assignee?: {
    id: string | number;
    name: string;
  };
  _links: {
    self: { href: string };
    project: { href: string };
  };
}

export interface NativeProjectMetrics {
  id: string | number;
  name: string;
  identifier: string;
  status: string;
  statusExplanation?: string;
  
  // Calculated by OpenProject
  totalEstimatedHours: number;
  totalSpentHours: number;
  overallPercentComplete: number;
  activeWorkPackages: number;
  completedWorkPackages: number;
  totalWorkPackages: number;
  
  // Raw data for custom calculations
  workPackages: NativeWorkPackageData[];
  timeEntries: NativeTimeEntry[];
  budgetInfo?: NativeBudgetData;
}

export interface NativeTimeEntry {
  id: string | number;
  hours: number;
  spentOn: string; // Date
  comment?: string;
  user: {
    id: string | number;
    name: string;
  };
  workPackage?: {
    id: string | number;
    subject: string;
  };
  project: {
    id: string | number;
    name: string;
  };
  activity?: {
    id: string | number;
    name: string;
  };
}

export interface NativeBudgetData {
  id: string | number;
  subject: string;
  // Note: OpenProject budget API is currently minimal
  // We'll extend this via custom fields
}

//
// PMO Variable Storage (stored as OpenProject custom fields)
//
export interface PMOVariables {
  // Financial Variables
  standardLaborRate: number;
  overtimeMultiplier: number;
  contingencyPercentage: number;
  managementReservePercentage: number;
  
  // Performance Thresholds
  costPerformanceThreshold: number; // e.g., 0.95
  schedulePerformanceThreshold: number; // e.g., 0.95
  qualityThreshold: number;
  
  // Resource Variables
  defaultUtilizationRate: number; // e.g., 0.85
  maxAllocation: number; // e.g., 1.0 (100%)
  workingHoursPerDay: number;
  workingDaysPerWeek: number;
  
  // Risk Variables
  riskTolerance: 'low' | 'medium' | 'high';
  riskAppetite: 'conservative' | 'moderate' | 'aggressive';
  
  // Calculation Methods
  evmMethod: 'traditional' | 'earned_schedule' | 'weighted_milestone';
  forecastMethod: 'CPI' | 'SPI_CPI' | 'custom_regression';
  
  // Industry/Project Specific
  industryType: string;
  complexityFactor: number; // 1.0 = normal, >1.0 = more complex
  technologyRiskFactor: number;
  
  // Organizational
  approvalThreshold: number;
  changeControlThreshold: number;
  escalationThreshold: number;
}

//
// Custom Enterprise Calculations (not available in OpenProject Community)
//
export interface EVMCalculation {
  // Input metrics
  budgetAtCompletion: number;
  plannedValue: number;
  earnedValue: number;
  actualCost: number;
  
  // Performance indices
  costPerformanceIndex: number;
  schedulePerformanceIndex: number;
  
  // Variances
  costVariance: number;
  scheduleVariance: number;
  
  // Forecasts
  estimateAtCompletion: number;
  estimateToComplete: number;
  varianceAtCompletion: number;
  toCompletePerformanceIndex: number;
  
  // Status
  costStatus: 'Under Budget' | 'Over Budget' | 'Seriously Over Budget';
  scheduleStatus: 'Ahead' | 'On Track' | 'Behind' | 'Seriously Behind';
  overallHealth: 'Green' | 'Yellow' | 'Red';
  
  // Calculation metadata
  calculationDate: string;
  method: string;
  confidence: number;
  // Additional forecast variants for transparency (PMI-recognized formulas)
  forecastVariants?: {
    cpiBased: number;                 // BAC / CPI
    budgetRate: number;               // AC + (BAC - EV)
    spiCpiCombined: number;           // AC + ((BAC - EV) / (CPI * SPI))
    acPlusRemainingOverCpi: number;   // AC + (BAC - EV) / CPI
  };
  forecastMethodApplied?: string; // Which variant populated estimateAtCompletion
}

export interface CriticalPathNode {
  id: string | number;
  name: string;
  duration: number;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
  percentComplete: number;
  predecessors: string[];
  successors: string[];
}

export interface CriticalPathAnalysis {
  nodes: Map<string, CriticalPathNode>;
  criticalPath: string[];
  projectDuration: number;
  criticalPathLength: number;
  totalFloat: number;
  scheduleRisk: 'Low' | 'Medium' | 'High';
  recommendations: string[];
  analysisDate: string;
}

export interface ResourceUtilization {
  userId: string | number;
  userName: string;
  totalAllocatedHours: number;
  totalWorkedHours: number;
  utilizationRate: number;
  overallocation: boolean;
  availableCapacity: number;
  projects: {
    projectId: string | number;
    projectName: string;
    allocatedHours: number;
    workedHours: number;
    utilizationRate: number;
  }[];
}

//
// Complete Hybrid Data Structure
//
export interface HybridProjectData {
  // Native OpenProject calculated data (always fresh)
  native: NativeProjectMetrics;
  
  // PMO variables (stored as custom fields in OpenProject)
  variables: PMOVariables;
  
  // Custom enterprise calculations (cached with TTL)
  calculations?: {
    evm?: EVMCalculation;
    criticalPath?: CriticalPathAnalysis;
    resourceUtilization?: ResourceUtilization[];
    lastUpdated: string;
    ttl: number; // seconds
  };
}

//
// Cache Management
//
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in seconds
  projectId: string | number;
  calculationType: string;
}

export interface CacheStrategy {
  neverCache: string[];
  cacheForSession: string[];
  cacheWithExpiry: {
    key: string;
    ttlSeconds: number;
  }[];
}

//
// Zod Schemas for Validation
//
export const PMOVariablesSchema = z.object({
  standardLaborRate: z.number().positive(),
  overtimeMultiplier: z.number().min(1),
  contingencyPercentage: z.number().min(0).max(1),
  managementReservePercentage: z.number().min(0).max(1),
  costPerformanceThreshold: z.number().positive(),
  schedulePerformanceThreshold: z.number().positive(),
  qualityThreshold: z.number().min(0).max(1),
  defaultUtilizationRate: z.number().min(0).max(1),
  maxAllocation: z.number().positive().max(2), // Allow up to 200% allocation
  workingHoursPerDay: z.number().positive().max(24),
  workingDaysPerWeek: z.number().positive().max(7),
  riskTolerance: z.enum(['low', 'medium', 'high']),
  riskAppetite: z.enum(['conservative', 'moderate', 'aggressive']),
  evmMethod: z.enum(['traditional', 'earned_schedule', 'weighted_milestone']),
  forecastMethod: z.enum(['CPI', 'SPI_CPI', 'custom_regression']),
  industryType: z.string().min(1),
  complexityFactor: z.number().positive(),
  technologyRiskFactor: z.number().positive(),
  approvalThreshold: z.number().nonnegative(),
  changeControlThreshold: z.number().nonnegative(),
  escalationThreshold: z.number().nonnegative(),
}).strict();

export const EVMCalculationSchema = z.object({
  budgetAtCompletion: z.number().nonnegative(),
  plannedValue: z.number().nonnegative(),
  earnedValue: z.number().nonnegative(),
  actualCost: z.number().nonnegative(),
  costPerformanceIndex: z.number().positive(),
  schedulePerformanceIndex: z.number().positive(),
  costVariance: z.number(),
  scheduleVariance: z.number(),
  estimateAtCompletion: z.number().positive(),
  estimateToComplete: z.number().nonnegative(),
  varianceAtCompletion: z.number(),
  toCompletePerformanceIndex: z.number().positive(),
  costStatus: z.enum(['Under Budget', 'Over Budget', 'Seriously Over Budget']),
  scheduleStatus: z.enum(['Ahead', 'On Track', 'Behind', 'Seriously Behind']),
  overallHealth: z.enum(['Green', 'Yellow', 'Red']),
  calculationDate: z.string(),
  method: z.string(),
  confidence: z.number().min(0).max(1),
  forecastVariants: z.object({
    cpiBased: z.number().positive(),
    budgetRate: z.number().positive(),
    spiCpiCombined: z.number().positive(),
    acPlusRemainingOverCpi: z.number().positive()
  }).partial().optional(),
  forecastMethodApplied: z.string().optional()
}).strict();

//
// Default Values
//
export const DEFAULT_PMO_VARIABLES: PMOVariables = {
  standardLaborRate: 75,
  overtimeMultiplier: 1.5,
  contingencyPercentage: 0.10,
  managementReservePercentage: 0.05,
  costPerformanceThreshold: 0.95,
  schedulePerformanceThreshold: 0.95,
  qualityThreshold: 0.90,
  defaultUtilizationRate: 0.85,
  maxAllocation: 1.0,
  workingHoursPerDay: 8,
  workingDaysPerWeek: 5,
  riskTolerance: 'medium',
  riskAppetite: 'moderate',
  evmMethod: 'traditional',
  forecastMethod: 'CPI',
  industryType: 'software',
  complexityFactor: 1.0,
  technologyRiskFactor: 1.0,
  approvalThreshold: 10000,
  changeControlThreshold: 5000,
  escalationThreshold: 25000,
};