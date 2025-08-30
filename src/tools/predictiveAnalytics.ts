// src/tools/predictiveAnalytics.ts
import { z } from "zod";
import { opFetch, joinUrl } from "../util/op";

// ===== PREDICTIVE ANALYTICS SCHEMAS =====

const PredictionModelSchema = z.enum([
  "ensemble_ml",        // Combined multiple models
  "decision_tree",      // Decision tree analysis
  "logistic_regression", // Probability-based prediction
  "pattern_matching",   // Historical pattern analysis
  "risk_weighted",      // Risk-adjusted prediction
  "simple_heuristic"    // Rule-based simple model
]);

const ProjectSuccessFactorSchema = z.enum([
  "team_experience",
  "scope_stability",
  "stakeholder_engagement",
  "budget_adequacy", 
  "timeline_realism",
  "technical_complexity",
  "change_frequency",
  "resource_availability",
  "external_dependencies",
  "executive_support"
]);

const OptimizationGoalSchema = z.enum([
  "schedule_recovery",
  "cost_optimization",
  "quality_improvement",
  "risk_mitigation", 
  "resource_efficiency",
  "stakeholder_satisfaction"
]);

const BenchmarkTypeSchema = z.enum([
  "industry_average",
  "organizational_history",
  "peer_projects",
  "best_practices",
  "similar_projects"
]);

// Predict Project Success Schema
export const predictProjectSuccessInput = z.object({
  projectId: z.union([z.string(), z.number()]),
  predictionModel: PredictionModelSchema.default("ensemble_ml"),
  factors: z.array(ProjectSuccessFactorSchema).optional(),
  includeConfidenceInterval: z.boolean().default(true),
  predictionHorizon: z.enum(["1_month", "3_months", "6_months", "project_completion"]).default("project_completion"),
  includeRiskFactors: z.boolean().default(true),
  includeRecommendations: z.boolean().default(true),
  historicalDataPeriod: z.enum(["6_months", "12_months", "24_months", "all_time"]).default("12_months"),
  similarProjectsThreshold: z.number().min(0).max(1).default(0.7)
});

// Recommend Actions Schema
export const recommendActionsInput = z.object({
  projectId: z.union([z.string(), z.number()]),
  currentHealth: z.enum(["green", "amber", "red", "unknown"]),
  optimizationGoal: OptimizationGoalSchema.default("schedule_recovery"),
  priorityLevel: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  availableResources: z.array(z.string()).optional(),
  constraintFactors: z.array(z.string()).optional(),
  timeframe: z.enum(["immediate", "short_term", "medium_term", "long_term"]).default("short_term"),
  includeAlternatives: z.boolean().default(true),
  maxRecommendations: z.number().min(1).max(20).default(5)
});

// Benchmark Performance Schema
export const benchmarkPerformanceInput = z.object({
  projectId: z.union([z.string(), z.number()]),
  benchmarkAgainst: BenchmarkTypeSchema.default("organizational_history"),
  projectType: z.string().optional(),
  organizationSize: z.enum(["small", "medium", "large", "enterprise"]).optional(),
  industry: z.string().optional(),
  includeMetrics: z.array(z.enum([
    "schedule_performance",
    "budget_performance", 
    "quality_metrics",
    "resource_utilization",
    "stakeholder_satisfaction",
    "delivery_success_rate",
    "change_request_rate",
    "defect_rate"
  ])).optional(),
  confidenceLevel: z.number().min(80).max(99).default(95),
  includeProjections: z.boolean().default(true),
  detailedAnalysis: z.boolean().default(false)
});

// ===== PREDICTIVE ANALYTICS FUNCTIONS =====

export async function predictProjectSuccess(
  ctx: { env: any },
  input: z.infer<typeof predictProjectSuccessInput>
) {
  // Get project details
  const { json: projectResponse } = await opFetch<any>(ctx.env, `/api/v3/projects/${input.projectId}`);
  
  // Get work packages for analysis
  const { json: workPackagesResponse } = await opFetch<any>(ctx.env, "/api/v3/work_packages", {
    params: {
      filters: JSON.stringify([
        {
          "project": {
            "operator": "=",
            "values": [input.projectId.toString()]
          }
        }
      ]),
      pageSize: 100
    }
  });

  const workPackages = workPackagesResponse._embedded?.elements || [];

  // Get project activities for trend analysis
  let activities = [];
  try {
    const activitiesUrl = `/api/v3/projects/${input.projectId}/activities`;
    const { json: activitiesResponse } = await opFetch<any>(ctx.env, activitiesUrl);
    activities = activitiesResponse._embedded?.elements?.slice(0, 50) || [];
  } catch (error: any) {
    console.warn("Could not fetch project activities:", error);
  }

  // Get time entries for effort analysis
  let timeEntries = [];
  try {
    const { json: timeEntriesResponse } = await opFetch<any>(ctx.env, "/api/v3/time_entries", {
      params: {
        filters: JSON.stringify([
          {
            "project": {
              "operator": "=",
              "values": [input.projectId.toString()]
            }
          }
        ]),
        pageSize: 100
      }
    });
    timeEntries = timeEntriesResponse._embedded?.elements || [];
  } catch (error: any) {
    console.warn("Could not fetch time entries:", error);
  }

  // Extract project metrics for prediction
  const projectMetrics = analyzeProjectMetrics(
    projectResponse, 
    workPackages, 
    activities, 
    timeEntries
  );

  // Apply prediction model
  let predictionResult;
  switch (input.predictionModel) {
    case "ensemble_ml":
      predictionResult = applyEnsembleModel(projectMetrics, input);
      break;
    case "decision_tree":
      predictionResult = applyDecisionTreeModel(projectMetrics, input);
      break;
    case "pattern_matching":
      predictionResult = applyPatternMatchingModel(projectMetrics, input);
      break;
    default:
      predictionResult = applyHeuristicModel(projectMetrics, input);
  }

  // Generate confidence intervals if requested
  if (input.includeConfidenceInterval) {
    predictionResult.confidenceInterval = generateConfidenceInterval(
      predictionResult.successProbability,
      projectMetrics
    );
  }

  // Identify risk factors if requested
  if (input.includeRiskFactors) {
    predictionResult.riskFactors = identifyRiskFactors(projectMetrics, workPackages);
  }

  // Generate recommendations if requested
  if (input.includeRecommendations) {
    predictionResult.recommendations = generateSuccessRecommendations(
      projectMetrics,
      predictionResult,
      input
    );
  }

  return {
    projectSuccessPrediction: predictionResult,
    projectMetrics: projectMetrics,
    predictionModel: input.predictionModel,
    predictionDate: new Date().toISOString(),
    dataPointsAnalyzed: {
      workPackages: workPackages.length,
      activities: activities.length,
      timeEntries: timeEntries.length
    }
  };
}

export async function recommendActions(
  ctx: { env: any },
  input: z.infer<typeof recommendActionsInput>
) {
  // Get project details
  const { json: projectResponse } = await opFetch<any>(ctx.env, `/api/v3/projects/${input.projectId}`);
  
  // Get work packages for current status analysis
  const { json: workPackagesResponse } = await opFetch<any>(ctx.env, "/api/v3/work_packages", {
    params: {
      filters: JSON.stringify([
        {
          "project": {
            "operator": "=",
            "values": [input.projectId.toString()]
          }
        }
      ]),
      pageSize: 100
    }
  });

  const workPackages = workPackagesResponse._embedded?.elements || [];

  // Analyze current project state
  const currentState = analyzeProjectCurrentState(
    projectResponse,
    workPackages,
    input.currentHealth
  );

  // Generate action recommendations based on optimization goal and current state
  const recommendations = generateActionRecommendations(
    currentState,
    input.optimizationGoal,
    input.priorityLevel,
    input.timeframe
  );

  // Filter and rank recommendations
  const rankedRecommendations = recommendations
    .sort((a, b) => b.impact - a.impact)
    .slice(0, input.maxRecommendations);

  // Generate alternatives if requested
  let alternatives = [];
  if (input.includeAlternatives) {
    alternatives = generateAlternativeActions(
      currentState,
      rankedRecommendations,
      input.constraintFactors || []
    );
  }

  return {
    actionRecommendations: rankedRecommendations,
    alternatives: alternatives,
    currentProjectState: currentState,
    optimizationGoal: input.optimizationGoal,
    priorityLevel: input.priorityLevel,
    analysisDate: new Date().toISOString(),
    recommendationCount: rankedRecommendations.length
  };
}

export async function benchmarkPerformance(
  ctx: { env: any },
  input: z.infer<typeof benchmarkPerformanceInput>
) {
  // Get project details
  const { json: projectResponse } = await opFetch<any>(ctx.env, `/api/v3/projects/${input.projectId}`);
  
  // Get work packages for performance analysis
  const { json: workPackagesResponse } = await opFetch<any>(ctx.env, "/api/v3/work_packages", {
    params: {
      filters: JSON.stringify([
        {
          "project": {
            "operator": "=",
            "values": [input.projectId.toString()]
          }
        }
      ]),
      pageSize: 200
    }
  });

  const workPackages = workPackagesResponse._embedded?.elements || [];

  // Get time entries for efficiency metrics
  let timeEntries = [];
  try {
    const { json: timeEntriesResponse } = await opFetch<any>(ctx.env, "/api/v3/time_entries", {
      params: {
        filters: JSON.stringify([
          {
            "project": {
              "operator": "=",
              "values": [input.projectId.toString()]
            }
          }
        ]),
        pageSize: 200
      }
    });
    timeEntries = timeEntriesResponse._embedded?.elements || [];
  } catch (error: any) {
    console.warn("Could not fetch time entries for benchmarking:", error);
  }

  // Calculate current project performance metrics
  const currentMetrics = calculatePerformanceMetrics(
    projectResponse,
    workPackages,
    timeEntries
  );

  // Get benchmark data based on benchmark type
  const benchmarkData = await getBenchmarkData(
    input.benchmarkAgainst,
    input.projectType,
    input.industry,
    ctx.env
  );

  // Perform comparison analysis
  const benchmarkAnalysis = performBenchmarkComparison(
    currentMetrics,
    benchmarkData,
    input.includeMetrics || [],
    input.confidenceLevel
  );

  // Generate projections if requested
  let projections = {};
  if (input.includeProjections) {
    projections = generatePerformanceProjections(
      currentMetrics,
      benchmarkData,
      workPackages
    );
  }

  // Detailed analysis if requested
  let detailedInsights = {};
  if (input.detailedAnalysis) {
    detailedInsights = generateDetailedBenchmarkInsights(
      benchmarkAnalysis,
      currentMetrics,
      benchmarkData
    );
  }

  return {
    benchmarkAnalysis: benchmarkAnalysis,
    currentProjectMetrics: currentMetrics,
    benchmarkData: benchmarkData,
    projections: projections,
    detailedInsights: detailedInsights,
    benchmarkType: input.benchmarkAgainst,
    confidenceLevel: input.confidenceLevel,
    analysisDate: new Date().toISOString()
  };
}

// ===== HELPER FUNCTIONS =====

function analyzeProjectMetrics(project: any, workPackages: any[], activities: any[], timeEntries: any[]): any {
  const now = new Date();
  const projectCreated = new Date(project.createdAt);
  const projectAge = Math.max(1, Math.floor((now.getTime() - projectCreated.getTime()) / (1000 * 60 * 60 * 24)));

  // Work package analysis
  const totalWPs = workPackages.length;
  const completedWPs = workPackages.filter(wp => 
    wp.percentDone === 100 || wp.status?.name?.toLowerCase().includes("closed")
  ).length;
  const overdueWPs = workPackages.filter(wp => 
    wp.dueDate && new Date(wp.dueDate) < now && wp.percentDone < 100
  ).length;
  const avgPercentDone = totalWPs > 0 ? 
    workPackages.reduce((sum, wp) => sum + (wp.percentDone || 0), 0) / totalWPs : 0;

  // Activity analysis
  const recentActivityCount = activities.filter((activity: any) => 
    new Date(activity.createdAt) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  // Time tracking analysis
  const totalHours = timeEntries.reduce((sum: number, entry: any) => sum + (entry.hours || 0), 0);
  const avgHoursPerDay = projectAge > 0 ? totalHours / projectAge : 0;

  // Team analysis
  const uniqueUsers = new Set([
    ...workPackages.map((wp: any) => wp._links?.assignee?.href).filter(Boolean),
    ...timeEntries.map((entry: any) => entry._links?.user?.href).filter(Boolean)
  ]).size;

  // Change frequency analysis
  const changeActivities = activities.filter((activity: any) => 
    activity.comment?.toLowerCase().includes("changed") ||
    activity.comment?.toLowerCase().includes("updated") ||
    activity.details?.some((detail: any) => detail.format === "diff")
  ).length;

  return {
    projectAge: projectAge,
    totalWorkPackages: totalWPs,
    completionRate: totalWPs > 0 ? (completedWPs / totalWPs) * 100 : 0,
    overdueRate: totalWPs > 0 ? (overdueWPs / totalWPs) * 100 : 0,
    averageProgress: avgPercentDone,
    activityLevel: recentActivityCount / 7, // Activities per day
    totalEffort: totalHours,
    effortRate: avgHoursPerDay,
    teamSize: uniqueUsers,
    changeFrequency: changeActivities / Math.max(1, projectAge / 7), // Changes per week
    healthIndicators: {
      scope_stability: changeActivities < projectAge * 0.1,
      team_engagement: recentActivityCount > 0,
      progress_momentum: avgPercentDone > 0,
      timeline_adherence: (totalWPs > 0 ? (overdueWPs / totalWPs) * 100 : 0) < 20
    }
  };
}

function applyEnsembleModel(metrics: any, input: any): any {
  // Combine multiple prediction approaches
  const heuristicScore = applyHeuristicModel(metrics, input).successProbability;
  const patternScore = applyPatternMatchingModel(metrics, input).successProbability;
  const decisionScore = applyDecisionTreeModel(metrics, input).successProbability;
  
  // Weighted average with higher weight on more reliable methods
  const ensembleScore = (heuristicScore * 0.4 + patternScore * 0.3 + decisionScore * 0.3);
  
  return {
    successProbability: Math.max(0, Math.min(100, ensembleScore)),
    modelComponents: {
      heuristic: heuristicScore,
      pattern: patternScore,
      decision: decisionScore
    },
    confidence: calculateModelConfidence(metrics),
    predictionFactors: extractPredictionFactors(metrics)
  };
}

function applyDecisionTreeModel(metrics: any, input: any): any {
  let score = 70; // Base score
  
  // Decision tree logic
  if (metrics.completionRate > 80) {
    score += 20;
  } else if (metrics.completionRate > 50) {
    score += 10;
  } else if (metrics.completionRate < 20) {
    score -= 20;
  }
  
  if (metrics.overdueRate < 10) {
    score += 15;
  } else if (metrics.overdueRate > 30) {
    score -= 25;
  }
  
  if (metrics.healthIndicators.scope_stability) {
    score += 10;
  } else {
    score -= 15;
  }
  
  if (metrics.teamSize >= 3 && metrics.teamSize <= 8) {
    score += 5;
  } else if (metrics.teamSize > 12) {
    score -= 10;
  }
  
  return {
    successProbability: Math.max(0, Math.min(100, score)),
    decisionPath: generateDecisionPath(metrics),
    keyFactors: identifyKeyDecisionFactors(metrics)
  };
}

function applyPatternMatchingModel(metrics: any, input: any): any {
  // Pattern matching based on historical project patterns
  const patterns = [
    { pattern: "high_completion_low_overdue", match: metrics.completionRate > 70 && metrics.overdueRate < 15, score: 85 },
    { pattern: "steady_progress", match: metrics.averageProgress > 60 && metrics.activityLevel > 1, score: 80 },
    { pattern: "good_team_size", match: metrics.teamSize >= 3 && metrics.teamSize <= 10, score: 75 },
    { pattern: "low_change_frequency", match: metrics.changeFrequency < 2, score: 70 },
    { pattern: "high_activity", match: metrics.activityLevel > 3, score: 78 }
  ];
  
  const matchedPatterns = patterns.filter(p => p.match);
  const patternScore = matchedPatterns.length > 0 ? 
    matchedPatterns.reduce((sum, p) => sum + p.score, 0) / matchedPatterns.length : 50;
  
  return {
    successProbability: Math.max(0, Math.min(100, patternScore)),
    matchedPatterns: matchedPatterns.map(p => p.pattern),
    patternStrength: matchedPatterns.length / patterns.length
  };
}

function applyHeuristicModel(metrics: any, input: any): any {
  // Simple rule-based heuristic model
  let score = 50; // Neutral starting point
  
  // Completion rate factor (30% weight)
  score += (metrics.completionRate - 50) * 0.6;
  
  // Overdue rate factor (20% weight)  
  score -= metrics.overdueRate * 0.4;
  
  // Activity level factor (15% weight)
  if (metrics.activityLevel > 2) score += 10;
  else if (metrics.activityLevel < 0.5) score -= 15;
  
  // Team size factor (15% weight)
  if (metrics.teamSize >= 3 && metrics.teamSize <= 8) score += 8;
  else if (metrics.teamSize > 15) score -= 12;
  
  // Health indicators (20% weight)
  const healthScore = Object.values(metrics.healthIndicators).filter(Boolean).length * 5;
  score += healthScore;
  
  return {
    successProbability: Math.max(0, Math.min(100, score)),
    heuristicFactors: {
      completionContribution: (metrics.completionRate - 50) * 0.6,
      overdueContribution: -metrics.overdueRate * 0.4,
      activityContribution: metrics.activityLevel > 2 ? 10 : (metrics.activityLevel < 0.5 ? -15 : 0),
      teamContribution: metrics.teamSize >= 3 && metrics.teamSize <= 8 ? 8 : (metrics.teamSize > 15 ? -12 : 0),
      healthContribution: healthScore
    }
  };
}

function generateConfidenceInterval(probability: number, metrics: any): any {
  // Calculate confidence interval based on data quality and quantity
  const dataQuality = calculateDataQuality(metrics);
  const marginOfError = (1 - dataQuality) * 15; // Up to 15% margin based on data quality
  
  return {
    lower: Math.max(0, probability - marginOfError),
    upper: Math.min(100, probability + marginOfError),
    marginOfError: marginOfError,
    confidence: dataQuality * 100
  };
}

function identifyRiskFactors(metrics: any, workPackages: any[]): any[] {
  const riskFactors = [];
  
  if (metrics.overdueRate > 25) {
    riskFactors.push({
      factor: "high_overdue_rate",
      severity: "high",
      impact: "Schedule delays likely",
      recommendation: "Review timeline and resource allocation"
    });
  }
  
  if (metrics.changeFrequency > 3) {
    riskFactors.push({
      factor: "scope_instability", 
      severity: "medium",
      impact: "Requirements volatility",
      recommendation: "Implement change control process"
    });
  }
  
  if (metrics.teamSize > 15) {
    riskFactors.push({
      factor: "large_team_coordination",
      severity: "medium", 
      impact: "Communication and coordination challenges",
      recommendation: "Consider team structure optimization"
    });
  }
  
  if (metrics.activityLevel < 0.5) {
    riskFactors.push({
      factor: "low_engagement",
      severity: "high",
      impact: "Project momentum at risk",
      recommendation: "Investigate team engagement and remove blockers"
    });
  }
  
  return riskFactors;
}

function generateSuccessRecommendations(metrics: any, prediction: any, input: any): string[] {
  const recommendations = [];
  
  if (prediction.successProbability < 60) {
    recommendations.push("Project success probability is below acceptable threshold - implement immediate interventions");
  }
  
  if (metrics.overdueRate > 20) {
    recommendations.push("High overdue rate - review and adjust timeline or add resources");
  }
  
  if (metrics.changeFrequency > 2) {
    recommendations.push("Implement stricter change control to reduce scope volatility");
  }
  
  if (metrics.activityLevel < 1) {
    recommendations.push("Increase project activity and stakeholder engagement");
  }
  
  if (metrics.teamSize < 3) {
    recommendations.push("Consider adding team members to reduce delivery risk");
  }
  
  return recommendations;
}

function analyzeProjectCurrentState(project: any, workPackages: any[], currentHealth: string): any {
  return {
    projectHealth: currentHealth,
    totalWorkPackages: workPackages.length,
    completedWorkPackages: workPackages.filter(wp => wp.percentDone === 100).length,
    overdueWorkPackages: workPackages.filter(wp => 
      wp.dueDate && new Date(wp.dueDate) < new Date() && wp.percentDone < 100
    ).length,
    averageProgress: workPackages.length > 0 ? 
      workPackages.reduce((sum, wp) => sum + (wp.percentDone || 0), 0) / workPackages.length : 0,
    statusDistribution: workPackages.reduce((acc, wp) => {
      const status = wp.status?.name || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    projectStatus: project.status?.name || "active",
    identifiedIssues: identifyCurrentIssues(workPackages, currentHealth)
  };
}

function generateActionRecommendations(state: any, goal: string, priority: string, timeframe: string): any[] {
  const recommendations = [];
  const urgencyMultiplier = priority === "critical" ? 1.5 : priority === "high" ? 1.2 : 1;
  
  // Schedule recovery recommendations
  if (goal === "schedule_recovery") {
    if (state.overdueWorkPackages > 0) {
      recommendations.push({
        action: "Address overdue work packages immediately",
        type: "schedule_recovery",
        impact: 8 * urgencyMultiplier,
        effort: "medium",
        timeframe: "immediate",
        description: `Focus on ${state.overdueWorkPackages} overdue items to get back on track`
      });
    }
    
    recommendations.push({
      action: "Implement daily standups for progress tracking",
      type: "process_improvement", 
      impact: 6 * urgencyMultiplier,
      effort: "low",
      timeframe: "immediate",
      description: "Increase visibility and accountability for deliverables"
    });
  }
  
  // Cost optimization recommendations
  if (goal === "cost_optimization") {
    recommendations.push({
      action: "Review resource allocation efficiency",
      type: "resource_optimization",
      impact: 7 * urgencyMultiplier,
      effort: "medium", 
      timeframe: "short_term",
      description: "Identify and eliminate resource inefficiencies"
    });
  }
  
  // Quality improvement recommendations
  if (goal === "quality_improvement") {
    recommendations.push({
      action: "Implement code/deliverable review process",
      type: "quality_assurance",
      impact: 8 * urgencyMultiplier, 
      effort: "medium",
      timeframe: "short_term",
      description: "Establish systematic quality checkpoints"
    });
  }
  
  // General health-based recommendations
  if (state.projectHealth === "red" || state.projectHealth === "amber") {
    recommendations.push({
      action: "Conduct project health assessment meeting", 
      type: "governance",
      impact: 9 * urgencyMultiplier,
      effort: "low",
      timeframe: "immediate",
      description: "Gather stakeholders to assess issues and create action plan"
    });
  }
  
  return recommendations;
}

function generateAlternativeActions(state: any, primaryRecommendations: any[], constraints: string[]): any[] {
  const alternatives = [];
  
  // Alternative approaches based on constraints
  if (constraints.includes("budget")) {
    alternatives.push({
      approach: "Low-cost improvement",
      actions: ["Improve communication processes", "Optimize existing workflows", "Implement peer reviews"],
      tradeoffs: "Lower cost but potentially slower results"
    });
  }
  
  if (constraints.includes("time")) {
    alternatives.push({
      approach: "Quick wins focus",
      actions: ["Address top 3 blockers only", "Implement minimal viable changes", "Focus on highest impact items"],
      tradeoffs: "Faster implementation but limited scope"
    });
  }
  
  if (constraints.includes("resources")) {
    alternatives.push({
      approach: "Process-focused approach",
      actions: ["Automate repetitive tasks", "Improve documentation", "Streamline approval processes"],
      tradeoffs: "No additional resources needed but requires process change"
    });
  }
  
  return alternatives;
}

function calculatePerformanceMetrics(project: any, workPackages: any[], timeEntries: any[]): any {
  const now = new Date();
  const projectStart = new Date(project.createdAt);
  const projectDuration = Math.max(1, (now.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    schedulePerformance: {
      plannedDuration: projectDuration,
      actualDuration: projectDuration,
      scheduleVariance: 0, // Would need baseline data
      onTimeDeliveryRate: calculateOnTimeDeliveryRate(workPackages)
    },
    budgetPerformance: {
      totalEffort: timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0),
      budgetVariance: 0, // Would need budget data
      costPerWorkPackage: workPackages.length > 0 ? 
        timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0) / workPackages.length : 0
    },
    qualityMetrics: {
      completionRate: workPackages.length > 0 ? 
        (workPackages.filter(wp => wp.percentDone === 100).length / workPackages.length) * 100 : 0,
      averageProgress: workPackages.length > 0 ?
        workPackages.reduce((sum, wp) => sum + (wp.percentDone || 0), 0) / workPackages.length : 0
    },
    resourceUtilization: {
      totalHours: timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0),
      averageHoursPerDay: timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0) / Math.max(1, projectDuration),
      teamProductivity: calculateTeamProductivity(timeEntries, workPackages)
    }
  };
}

function getBenchmarkData(benchmarkType: string, projectType?: string, industry?: string, env?: any): any {
  // In a real implementation, this would query historical data or industry benchmarks
  // For now, return simulated benchmark data
  const baseBenchmarks = {
    industry_average: {
      schedulePerformance: { onTimeDeliveryRate: 68, scheduleVariance: 15 },
      budgetPerformance: { budgetVariance: 12, costEfficiency: 82 },
      qualityMetrics: { completionRate: 85, customerSatisfaction: 78 },
      resourceUtilization: { utilizationRate: 75, productivity: 72 }
    },
    organizational_history: {
      schedulePerformance: { onTimeDeliveryRate: 72, scheduleVariance: 18 },
      budgetPerformance: { budgetVariance: 8, costEfficiency: 88 },
      qualityMetrics: { completionRate: 88, customerSatisfaction: 82 },
      resourceUtilization: { utilizationRate: 80, productivity: 78 }
    }
  };
  
  return baseBenchmarks[benchmarkType as keyof typeof baseBenchmarks] || baseBenchmarks.industry_average;
}

function performBenchmarkComparison(currentMetrics: any, benchmarkData: any, includeMetrics: string[], confidence: number): any {
  const comparison = {
    scheduleComparison: {
      current: currentMetrics.schedulePerformance.onTimeDeliveryRate,
      benchmark: benchmarkData.schedulePerformance.onTimeDeliveryRate,
      variance: currentMetrics.schedulePerformance.onTimeDeliveryRate - benchmarkData.schedulePerformance.onTimeDeliveryRate,
      performance: currentMetrics.schedulePerformance.onTimeDeliveryRate >= benchmarkData.schedulePerformance.onTimeDeliveryRate ? "above" : "below"
    },
    qualityComparison: {
      current: currentMetrics.qualityMetrics.completionRate,
      benchmark: benchmarkData.qualityMetrics.completionRate,
      variance: currentMetrics.qualityMetrics.completionRate - benchmarkData.qualityMetrics.completionRate,
      performance: currentMetrics.qualityMetrics.completionRate >= benchmarkData.qualityMetrics.completionRate ? "above" : "below"
    },
    overallRanking: "average" // Simplified ranking
  };
  
  return comparison;
}

function generatePerformanceProjections(currentMetrics: any, benchmarkData: any, workPackages: any[]): any {
  const currentTrend = currentMetrics.qualityMetrics.averageProgress / 100;
  
  return {
    projectedCompletion: Math.max(0, Math.min(100, currentTrend * 120)), // 20% optimistic projection
    estimatedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    confidenceLevel: 80,
    keyAssumptions: [
      "Current progress trend continues",
      "No major scope changes",
      "Team capacity remains stable"
    ]
  };
}

function generateDetailedBenchmarkInsights(analysis: any, currentMetrics: any, benchmarkData: any): any {
  return {
    strengths: identifyPerformanceStrengths(analysis),
    improvementOpportunities: identifyImprovementOpportunities(analysis),
    recommendedActions: generateBenchmarkBasedActions(analysis),
    riskFactors: identifyBenchmarkRiskFactors(analysis)
  };
}

// Additional helper functions
function calculateModelConfidence(metrics: any): number {
  let confidence = 70; // Base confidence
  
  if (metrics.totalWorkPackages >= 10) confidence += 10;
  if (metrics.projectAge >= 30) confidence += 10; 
  if (metrics.teamSize >= 3) confidence += 5;
  if (Object.values(metrics.healthIndicators).filter(Boolean).length >= 3) confidence += 5;
  
  return Math.min(95, confidence);
}

function extractPredictionFactors(metrics: any): string[] {
  const factors = [];
  
  if (metrics.completionRate > 70) factors.push("Strong completion rate");
  if (metrics.overdueRate < 15) factors.push("Good timeline adherence");
  if (metrics.activityLevel > 2) factors.push("High team engagement");
  if (metrics.teamSize >= 3 && metrics.teamSize <= 8) factors.push("Optimal team size");
  if (metrics.changeFrequency < 2) factors.push("Stable scope");
  
  return factors;
}

function generateDecisionPath(metrics: any): string[] {
  const path = ["Starting assessment"];
  
  if (metrics.completionRate > 50) {
    path.push("Good progress detected");
    if (metrics.overdueRate < 20) {
      path.push("Timeline adherence confirmed");
    } else {
      path.push("Timeline concerns identified");
    }
  } else {
    path.push("Progress concerns identified");
  }
  
  return path;
}

function identifyKeyDecisionFactors(metrics: any): string[] {
  return [
    `Completion rate: ${metrics.completionRate.toFixed(1)}%`,
    `Overdue rate: ${metrics.overdueRate.toFixed(1)}%`,
    `Team size: ${metrics.teamSize}`,
    `Activity level: ${metrics.activityLevel.toFixed(1)}/day`
  ];
}

function calculateDataQuality(metrics: any): number {
  let quality = 0.5; // Base quality
  
  if (metrics.totalWorkPackages >= 5) quality += 0.2;
  if (metrics.projectAge >= 14) quality += 0.2;
  if (metrics.teamSize >= 2) quality += 0.1;
  
  return Math.min(1, quality);
}

function identifyCurrentIssues(workPackages: any[], health: string): string[] {
  const issues = [];
  
  if (health === "red" || health === "amber") {
    issues.push("Project health indicator shows concerns");
  }
  
  const overdueCount = workPackages.filter(wp => 
    wp.dueDate && new Date(wp.dueDate) < new Date() && wp.percentDone < 100
  ).length;
  
  if (overdueCount > 0) {
    issues.push(`${overdueCount} work packages are overdue`);
  }
  
  const stuckCount = workPackages.filter(wp => 
    wp.percentDone > 0 && wp.percentDone < 100 && 
    (!wp.updatedAt || new Date(wp.updatedAt) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  ).length;
  
  if (stuckCount > 0) {
    issues.push(`${stuckCount} work packages appear stuck`);
  }
  
  return issues;
}

function calculateOnTimeDeliveryRate(workPackages: any[]): number {
  const completedWPs = workPackages.filter(wp => wp.percentDone === 100);
  if (completedWPs.length === 0) return 0;
  
  const onTimeWPs = completedWPs.filter(wp => 
    !wp.dueDate || new Date(wp.updatedAt || wp.createdAt) <= new Date(wp.dueDate)
  );
  
  return (onTimeWPs.length / completedWPs.length) * 100;
}

function calculateTeamProductivity(timeEntries: any[], workPackages: any[]): number {
  const totalHours = timeEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  const completedWPs = workPackages.filter(wp => wp.percentDone === 100).length;
  
  return totalHours > 0 ? completedWPs / (totalHours / 8) : 0; // Work packages per person-day
}

function identifyPerformanceStrengths(analysis: any): string[] {
  const strengths = [];
  
  if (analysis.scheduleComparison.performance === "above") {
    strengths.push("Schedule performance exceeds benchmark");
  }
  
  if (analysis.qualityComparison.performance === "above") {
    strengths.push("Quality metrics above industry average");
  }
  
  return strengths;
}

function identifyImprovementOpportunities(analysis: any): string[] {
  const opportunities = [];
  
  if (analysis.scheduleComparison.performance === "below") {
    opportunities.push("Schedule performance improvement needed");
  }
  
  if (analysis.qualityComparison.performance === "below") {
    opportunities.push("Quality metrics below benchmark");
  }
  
  return opportunities;
}

function generateBenchmarkBasedActions(analysis: any): string[] {
  const actions = [];
  
  if (analysis.scheduleComparison.variance < -10) {
    actions.push("Implement schedule recovery plan");
  }
  
  if (analysis.qualityComparison.variance < -5) {
    actions.push("Enhance quality assurance processes");
  }
  
  return actions;
}

function identifyBenchmarkRiskFactors(analysis: any): string[] {
  const risks = [];
  
  if (analysis.overallRanking === "below") {
    risks.push("Overall performance below acceptable levels");
  }
  
  return risks;
}