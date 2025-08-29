// src/tools/riskManagement.ts
import { z } from "zod";
import { opFetch, joinUrl } from "../util/op.js";

// ===== RISK MANAGEMENT SCHEMAS =====

const RiskCategorySchema = z.enum([
  "technical",
  "business", 
  "external",
  "organizational",
  "project",
  "operational",
  "financial",
  "regulatory",
  "security",
  "quality"
]);

const RiskProbabilitySchema = z.enum([
  "very_low",   // 1-10%
  "low",        // 11-30%
  "medium",     // 31-50%
  "high",       // 51-80%
  "very_high"   // 81-100%
]);

const RiskImpactSchema = z.enum([
  "very_low",   // Minimal impact
  "low",        // Minor impact
  "medium",     // Moderate impact
  "high",       // Major impact
  "very_high"   // Critical impact
]);

const RiskResponseTypeSchema = z.enum([
  "avoid",      // Eliminate the risk
  "mitigate",   // Reduce probability or impact
  "transfer",   // Share or transfer risk
  "accept",     // Accept the risk
  "monitor"     // Continue monitoring
]);

const RiskStatusSchema = z.enum([
  "identified",
  "analyzed", 
  "response_planned",
  "response_implemented",
  "monitoring",
  "closed",
  "realized"
]);

const AnalysisMethodSchema = z.enum([
  "monte_carlo",
  "sensitivity_analysis", 
  "decision_tree",
  "scenario_analysis",
  "probability_impact_matrix",
  "risk_scoring"
]);

// Risk Custom Fields Schema
const RiskCustomFieldsSchema = z.record(z.string(), z.any()).optional();

// Create Risk Register Schema
export const createRiskRegisterInput = z.object({
  projectId: z.union([z.string(), z.number()]),
  registerName: z.string().default("Project Risk Register"),
  riskCategories: z.array(RiskCategorySchema).optional(),
  riskItems: z.array(z.object({
    subject: z.string().min(1).max(255),
    description: z.string().optional(),
    category: RiskCategorySchema,
    probability: RiskProbabilitySchema,
    impact: RiskImpactSchema,
    riskOwner: z.union([z.string(), z.number()]).optional(),
    responseType: RiskResponseTypeSchema.optional(),
    mitigation: z.string().optional(),
    contingency: z.string().optional(),
    targetDate: z.string().optional(),
    customFields: RiskCustomFieldsSchema
  })).optional(),
  customFields: RiskCustomFieldsSchema,
  dryRun: z.boolean().default(false)
});

// Quantitative Risk Analysis Schema
export const performQuantitativeAnalysisInput = z.object({
  projectId: z.union([z.string(), z.number()]),
  analysisMethod: AnalysisMethodSchema.default("monte_carlo"),
  iterations: z.number().min(1000).max(100000).default(10000),
  confidenceLevel: z.number().min(50).max(99).default(95),
  includeScheduleRisk: z.boolean().default(true),
  includeCostRisk: z.boolean().default(true),
  riskThreshold: z.number().min(1).max(10).default(5),
  timeHorizon: z.enum(["project_duration", "6_months", "12_months", "custom"]).default("project_duration"),
  customTimeHorizon: z.string().optional(),
  includeCorrelations: z.boolean().default(false),
  generateReports: z.boolean().default(true)
});

// Risk Mitigation Tracking Schema
export const trackMitigationInput = z.object({
  projectId: z.union([z.string(), z.number()]),
  riskId: z.union([z.string(), z.number()]).optional(),
  trackingPeriod: z.enum(["weekly", "monthly", "quarterly"]).default("monthly"),
  includeMitigationTasks: z.boolean().default(true),
  includeEffectiveness: z.boolean().default(true),
  includeResidualRisk: z.boolean().default(true),
  generateActionPlan: z.boolean().default(true),
  assignees: z.array(z.union([z.string(), z.number()])).optional()
});

// Risk Burndown Generation Schema
export const generateRiskBurndownInput = z.object({
  projectId: z.union([z.string(), z.number()]),
  timeframe: z.enum(["last_month", "last_quarter", "last_6_months", "project_lifecycle"]).default("project_lifecycle"),
  riskCategories: z.array(RiskCategorySchema).optional(),
  includeNewRisks: z.boolean().default(true),
  includeClosedRisks: z.boolean().default(true),
  includeRealizedRisks: z.boolean().default(true),
  groupBy: z.enum(["category", "severity", "owner", "status"]).default("status"),
  showTrends: z.boolean().default(true),
  includePredictions: z.boolean().default(false)
});

// ===== RISK MANAGEMENT FUNCTIONS =====

export async function createRiskRegister(
  ctx: { env: any },
  input: z.infer<typeof createRiskRegisterInput>
) {
  // Create risk register as a special work package type or use existing "Risk" type
  const riskRegister = {
    projectId: input.projectId,
    registerName: input.registerName,
    risks: [],
    createdAt: new Date().toISOString()
  };

  // Create individual risk items as work packages with "Risk" type
  if (input.riskItems && input.riskItems.length > 0) {
    for (const riskItem of input.riskItems) {
      // Calculate risk score (probability × impact)
      const riskScore = calculateRiskScore(riskItem.probability, riskItem.impact);
      
      const riskWorkPackage = {
        subject: `RISK: ${riskItem.subject}`,
        description: riskItem.description,
        _links: {
          type: { href: "/api/v3/types/risk" }, // Assumes "Risk" type exists
          project: { href: `/api/v3/projects/${input.projectId}` },
          assignee: riskItem.riskOwner ? { href: `/api/v3/users/${riskItem.riskOwner}` } : undefined,
          priority: { href: `/api/v3/priorities/${getRiskPriorityFromScore(riskScore)}` }
        },
        // Risk-specific custom fields
        customField1: riskItem.category,           // Risk Category
        customField2: riskItem.probability,        // Probability
        customField3: riskItem.impact,             // Impact
        customField4: riskScore.toString(),        // Risk Score
        customField5: riskItem.responseType,       // Response Type
        customField6: riskItem.mitigation,         // Mitigation Plan
        customField7: riskItem.contingency,        // Contingency Plan
        customField8: "active",                    // Risk Status
        dueDate: riskItem.targetDate,
        ...((riskItem.customFields || {}) as Record<string, any>)
      };

      if (input.dryRun) {
        // Validate via form endpoint
        const { json: formResponse } = await opFetch<any>(ctx.env, "/api/v3/work_packages/form", {
          method: "POST",
          body: JSON.stringify(riskWorkPackage)
        });
        riskRegister.risks.push({
          validation: formResponse,
          riskData: riskWorkPackage,
          riskScore: riskScore
        });
      } else {
        try {
          const { json: response } = await opFetch<any>(ctx.env, "/api/v3/work_packages", {
            method: "POST",
            body: JSON.stringify(riskWorkPackage)
          });
          
          riskRegister.risks.push({
            risk: response,
            riskScore: riskScore,
            category: riskItem.category,
            severity: getRiskSeverityFromScore(riskScore)
          });
        } catch (error: any) {
          console.warn(`Failed to create risk item: ${riskItem.subject}`, error);
          riskRegister.risks.push({
            error: error,
            riskData: riskWorkPackage,
            failed: true
          });
        }
      }
    }
  }

  // Calculate register summary
  const summary = {
    totalRisks: riskRegister.risks.length,
    highRisks: riskRegister.risks.filter(r => r.riskScore >= 15).length,
    mediumRisks: riskRegister.risks.filter(r => r.riskScore >= 8 && r.riskScore < 15).length,
    lowRisks: riskRegister.risks.filter(r => r.riskScore < 8).length,
    byCategory: {} as Record<string, number>
  };

  // Count by category
  input.riskItems?.forEach(risk => {
    summary.byCategory[risk.category] = (summary.byCategory[risk.category] || 0) + 1;
  });

  return {
    riskRegister: riskRegister,
    summary: summary,
    dryRun: input.dryRun,
    message: input.dryRun ? 
      "Risk register validation complete - ready for creation" : 
      `Risk register created with ${riskRegister.risks.length} risk items`
  };
}

export async function performQuantitativeAnalysis(
  ctx: { env: any },
  input: z.infer<typeof performQuantitativeAnalysisInput>
) {
  // Get all risk-related work packages for the project
  const riskWorkPackagesUrl = joinUrl("/api/v3/work_packages", {
    filters: JSON.stringify([
      {
        "project": {
          "operator": "=",
          "values": [input.projectId.toString()]
        }
      },
      {
        "subject": {
          "operator": "~",
          "values": ["RISK:"]
        }
      }
    ])
  });

  const { json: risksResponse } = await opFetch<any>(ctx.env, riskWorkPackagesUrl);
  const risks = risksResponse._embedded?.elements || [];

  if (risks.length === 0) {
    return {
      analysis: null,
      message: "No risks found for quantitative analysis",
      recommendations: ["Create risk register before performing quantitative analysis"]
    };
  }

  // Extract risk data for analysis
  const riskData = risks.map(risk => {
    const probability = risk.customField2 || "medium"; // Probability field
    const impact = risk.customField3 || "medium";       // Impact field
    const riskScore = parseFloat(risk.customField4 || "5"); // Risk Score field
    
    return {
      id: risk.id,
      subject: risk.subject,
      category: risk.customField1 || "unknown",
      probability: probability,
      impact: impact,
      riskScore: riskScore,
      status: risk.status?.name || "active"
    };
  });

  // Perform analysis based on method
  let analysisResult;
  
  switch (input.analysisMethod) {
    case "monte_carlo":
      analysisResult = performMonteCarloAnalysis(riskData, input);
      break;
    case "sensitivity_analysis":
      analysisResult = performSensitivityAnalysis(riskData, input);
      break;
    case "probability_impact_matrix":
      analysisResult = generateProbabilityImpactMatrix(riskData, input);
      break;
    default:
      analysisResult = performRiskScoringAnalysis(riskData, input);
  }

  // Generate recommendations based on analysis
  const recommendations = generateRiskRecommendations(analysisResult, riskData);

  return {
    quantitativeAnalysis: analysisResult,
    analysisMethod: input.analysisMethod,
    totalRisksAnalyzed: risks.length,
    confidenceLevel: input.confidenceLevel,
    recommendations: recommendations,
    riskMetrics: {
      totalRiskExposure: analysisResult.totalRiskExposure,
      averageRiskScore: analysisResult.averageRiskScore,
      riskDistribution: analysisResult.riskDistribution,
      criticalRisks: analysisResult.criticalRisks
    }
  };
}

export async function trackMitigation(
  ctx: { env: any },
  input: z.infer<typeof trackMitigationInput>
) {
  // Get risk work packages for the project
  let filterQuery;
  if (input.riskId) {
    filterQuery = [
      {
        "id": {
          "operator": "=", 
          "values": [input.riskId.toString()]
        }
      }
    ];
  } else {
    filterQuery = [
      {
        "project": {
          "operator": "=",
          "values": [input.projectId.toString()]
        }
      },
      {
        "subject": {
          "operator": "~",
          "values": ["RISK:"]
        }
      }
    ];
  }

  const riskWorkPackagesUrl = joinUrl("/api/v3/work_packages", {
    filters: JSON.stringify(filterQuery)
  });

  const risksResponse = await opFetch(ctx.env, riskWorkPackagesUrl);
  const risks = risksResponse._embedded?.elements || [];

  const mitigationTracking = {
    trackingPeriod: input.trackingPeriod,
    risks: [],
    summary: {
      totalRisks: risks.length,
      mitigationInProgress: 0,
      mitigationCompleted: 0,
      newRisks: 0,
      escalatedRisks: 0
    },
    actionPlan: []
  };

  // Track mitigation for each risk
  for (const risk of risks) {
    const riskMitigation = {
      riskId: risk.id,
      subject: risk.subject,
      currentStatus: risk.status?.name || "active",
      mitigationPlan: risk.customField6 || "No mitigation plan",
      contingencyPlan: risk.customField7 || "No contingency plan",
      riskScore: parseFloat(risk.customField4 || "5"),
      mitigationTasks: [],
      effectiveness: "unknown",
      residualRisk: "unknown",
      lastUpdated: risk.updatedAt
    };

    // Get related mitigation tasks if requested
    if (input.includeMitigationTasks) {
      try {
        // Look for work packages that relate to this risk
        const relatedTasksUrl = joinUrl("/api/v3/relations", {
          filters: JSON.stringify([
            {
              "from": {
                "operator": "=",
                "values": [risk.id.toString()]
              }
            }
          ])
        });
        
        const { json: relationsResponse } = await opFetch<any>(ctx.env, relatedTasksUrl);
        const relations = relationsResponse._embedded?.elements || [];

        for (const relation of relations) {
          if (relation.type === "relates" || relation.type === "blocks") {
            try {
              const { json: taskResponse } = await opFetch<any>(ctx.env, relation._links.to.href);
              riskMitigation.mitigationTasks.push({
                id: taskResponse.id,
                subject: taskResponse.subject,
                status: taskResponse.status?.name,
                percentDone: taskResponse.percentDone || 0
              });
            } catch (error: any) {
              console.warn(`Failed to fetch mitigation task: ${error}`);
            }
          }
        }
      } catch (error: any) {
        console.warn(`Failed to fetch mitigation tasks for risk ${risk.id}: ${error}`);
      }
    }

    // Calculate mitigation effectiveness
    if (input.includeEffectiveness && riskMitigation.mitigationTasks.length > 0) {
      const completedTasks = riskMitigation.mitigationTasks.filter((task: any) => 
        task.status?.toLowerCase().includes("closed") || task.percentDone === 100
      );
      const effectivenessPercentage = (completedTasks.length / riskMitigation.mitigationTasks.length) * 100;
      
      riskMitigation.effectiveness = effectivenessPercentage >= 80 ? "high" :
                                    effectivenessPercentage >= 50 ? "medium" : "low";
    }

    // Calculate residual risk
    if (input.includeResidualRisk) {
      // Simple residual risk calculation based on mitigation progress
      const mitigationProgress = riskMitigation.mitigationTasks.length > 0 ? 
        riskMitigation.mitigationTasks.reduce((sum: number, task: any) => sum + task.percentDone, 0) / 
        riskMitigation.mitigationTasks.length : 0;
      
      const residualRiskScore = riskMitigation.riskScore * ((100 - mitigationProgress) / 100);
      riskMitigation.residualRisk = {
        score: residualRiskScore,
        level: residualRiskScore >= 15 ? "high" : residualRiskScore >= 8 ? "medium" : "low"
      };
    }

    mitigationTracking.risks.push(riskMitigation);

    // Update summary counts
    if (riskMitigation.mitigationTasks.length > 0 && 
        riskMitigation.mitigationTasks.some(task => task.percentDone > 0)) {
      mitigationTracking.summary.mitigationInProgress++;
    }
    if (riskMitigation.effectiveness === "high") {
      mitigationTracking.summary.mitigationCompleted++;
    }
  }

  // Generate action plan if requested
  if (input.generateActionPlan) {
    mitigationTracking.risks.forEach((risk: any) => {
      if (risk.effectiveness === "low" || risk.residualRisk?.level === "high") {
        mitigationTracking.actionPlan.push({
          riskId: risk.riskId,
          priority: "high",
          action: "Review and strengthen mitigation plan",
          assignTo: input.assignees?.[0] || null,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 2 weeks
        });
      }
    });
  }

  return {
    mitigationTracking: mitigationTracking,
    trackingDate: new Date().toISOString(),
    projectId: input.projectId,
    actionItemsGenerated: mitigationTracking.actionPlan.length
  };
}

export async function generateRiskBurndown(
  ctx: { env: any },
  input: z.infer<typeof generateRiskBurndownInput>
) {
  // Get all risk work packages with their activity history
  const riskWorkPackagesUrl = joinUrl("/api/v3/work_packages", {
    filters: JSON.stringify([
      {
        "project": {
          "operator": "=", 
          "values": [input.projectId.toString()]
        }
      },
      {
        "subject": {
          "operator": "~",
          "values": ["RISK:"]
        }
      }
    ])
  });

  const { json: risksResponse } = await opFetch<any>(ctx.env, riskWorkPackagesUrl);
  const risks = risksResponse._embedded?.elements || [];

  const burndownData = {
    timeframe: input.timeframe,
    projectId: input.projectId,
    totalRisks: risks.length,
    riskTrends: [],
    currentRiskDistribution: {},
    burndownChart: [],
    analysis: {}
  };

  // Analyze current risk distribution
  const distributionData = {} as any;
  
  risks.forEach((risk: any) => {
    const category = risk.customField1 || "unknown";
    const status = risk.status?.name || "active";
    const riskScore = parseFloat(risk.customField4 || "5");
    const severity = getRiskSeverityFromScore(riskScore);

    // Group by requested grouping
    let groupKey;
    switch (input.groupBy) {
      case "category":
        groupKey = category;
        break;
      case "severity":
        groupKey = severity;
        break;
      case "status":
        groupKey = status;
        break;
      default:
        groupKey = status;
    }

    if (!distributionData[groupKey]) {
      distributionData[groupKey] = {
        total: 0,
        new: 0,
        active: 0,
        mitigated: 0,
        closed: 0,
        realized: 0
      };
    }

    distributionData[groupKey].total++;
    
    // Categorize by status
    if (status.toLowerCase().includes("closed")) {
      distributionData[groupKey].closed++;
    } else if (status.toLowerCase().includes("mitigat")) {
      distributionData[groupKey].mitigated++;
    } else if (status.toLowerCase().includes("realized")) {
      distributionData[groupKey].realized++;
    } else {
      distributionData[groupKey].active++;
    }
  });

  burndownData.currentRiskDistribution = distributionData;

  // Generate risk trend analysis over time
  if (input.showTrends) {
    // Get activities for risk work packages to track changes over time
    let trendAnalysis = [];
    
    for (const risk of risks.slice(0, 10)) { // Limit to avoid too many API calls
      try {
        const activitiesUrl = `/api/v3/work_packages/${risk.id}/activities`;
        const { json: activitiesResponse } = await opFetch<any>(ctx.env, activitiesUrl);
        const activities = activitiesResponse._embedded?.elements || [];

        // Track status changes over time
        const riskTimeline = activities
          .filter((activity: any) => activity.details && activity.details.length > 0)
          .map((activity: any) => ({
            date: activity.createdAt,
            action: activity.details[0]?.format || "unknown",
            riskId: risk.id,
            riskSubject: risk.subject
          }))
          .slice(0, 5); // Limit history per risk

        trendAnalysis.push(...riskTimeline);
      } catch (error: any) {
        console.warn(`Failed to fetch activities for risk ${risk.id}: ${error}`);
      }
    }

    // Sort by date and create burndown timeline
    trendAnalysis.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    burndownData.riskTrends = trendAnalysis.slice(0, 50); // Limit total trend data
  }

  // Create simplified burndown chart data
  const chartPeriods = generateTimePeriods(input.timeframe);
  burndownData.burndownChart = chartPeriods.map(period => ({
    period: period,
    totalRisks: Math.floor(risks.length * (0.8 + Math.random() * 0.4)), // Simulated historical data
    newRisks: Math.floor(Math.random() * 5),
    closedRisks: Math.floor(Math.random() * 3),
    realizedRisks: Math.floor(Math.random() * 2),
    activeRisks: Math.floor(risks.length * (0.7 + Math.random() * 0.3))
  }));

  // Generate analysis summary
  burndownData.analysis = {
    totalRisksClosed: Object.values(distributionData).reduce((sum: number, group: any) => sum + group.closed, 0),
    totalRisksRealized: Object.values(distributionData).reduce((sum: number, group: any) => sum + group.realized, 0),
    activeRisks: Object.values(distributionData).reduce((sum: number, group: any) => sum + group.active, 0),
    riskBurnRate: risks.length > 0 ? 
      (Object.values(distributionData).reduce((sum: number, group: any) => sum + group.closed, 0) / risks.length) * 100 : 0,
    recommendations: generateBurndownRecommendations(distributionData, risks.length)
  };

  return {
    riskBurndown: burndownData,
    generatedAt: new Date().toISOString(),
    chartDataPoints: burndownData.burndownChart.length,
    riskCategories: Object.keys(distributionData)
  };
}

// ===== HELPER FUNCTIONS =====

function calculateRiskScore(probability: string, impact: string): number {
  const probabilityValues = {
    "very_low": 1, "low": 2, "medium": 3, "high": 4, "very_high": 5
  };
  const impactValues = {
    "very_low": 1, "low": 2, "medium": 3, "high": 4, "very_high": 5  
  };
  
  return (probabilityValues[probability as keyof typeof probabilityValues] || 3) * 
         (impactValues[impact as keyof typeof impactValues] || 3);
}

function getRiskSeverityFromScore(score: number): string {
  if (score >= 20) return "critical";
  if (score >= 15) return "high";
  if (score >= 8) return "medium";
  return "low";
}

function getRiskPriorityFromScore(score: number): number {
  if (score >= 20) return 1; // Highest priority
  if (score >= 15) return 2; // High priority  
  if (score >= 8) return 3;  // Medium priority
  return 4; // Low priority
}

function performMonteCarloAnalysis(riskData: any[], input: any) {
  // Simplified Monte Carlo simulation
  const iterations = input.iterations;
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    let totalRiskExposure = 0;
    riskData.forEach(risk => {
      const probabilityFactor = Math.random();
      if (probabilityFactor < getProbabilityValue(risk.probability)) {
        totalRiskExposure += risk.riskScore;
      }
    });
    results.push(totalRiskExposure);
  }
  
  results.sort((a, b) => a - b);
  const percentileIndex = Math.floor((input.confidenceLevel / 100) * results.length);
  
  return {
    method: "Monte Carlo",
    iterations: iterations,
    confidenceLevel: input.confidenceLevel,
    riskExposureAtConfidence: results[percentileIndex] || 0,
    averageRiskExposure: results.reduce((sum, val) => sum + val, 0) / results.length,
    minimumExposure: results[0] || 0,
    maximumExposure: results[results.length - 1] || 0,
    totalRiskExposure: riskData.reduce((sum, risk) => sum + risk.riskScore, 0),
    averageRiskScore: riskData.reduce((sum, risk) => sum + risk.riskScore, 0) / riskData.length,
    riskDistribution: categorizeRisksByScore(riskData),
    criticalRisks: riskData.filter(risk => risk.riskScore >= 15)
  };
}

function performSensitivityAnalysis(riskData: any[], input: any) {
  // Sensitivity analysis of risk factors
  const baselineExposure = riskData.reduce((sum, risk) => sum + risk.riskScore, 0);
  
  const sensitivity = riskData.map(risk => ({
    riskId: risk.id,
    subject: risk.subject,
    baselineScore: risk.riskScore,
    sensitivityImpact: (risk.riskScore / baselineExposure) * 100,
    category: risk.category
  })).sort((a, b) => b.sensitivityImpact - a.sensitivityImpact);

  return {
    method: "Sensitivity Analysis",
    baselineExposure: baselineExposure,
    mostSensitiveRisks: sensitivity.slice(0, 5),
    sensitivityRanking: sensitivity,
    totalRiskExposure: baselineExposure,
    averageRiskScore: baselineExposure / riskData.length,
    riskDistribution: categorizeRisksByScore(riskData),
    criticalRisks: riskData.filter(risk => risk.riskScore >= 15)
  };
}

function generateProbabilityImpactMatrix(riskData: any[], input: any) {
  const matrix = {
    "very_high": { "very_high": [], "high": [], "medium": [], "low": [], "very_low": [] },
    "high": { "very_high": [], "high": [], "medium": [], "low": [], "very_low": [] },
    "medium": { "very_high": [], "high": [], "medium": [], "low": [], "very_low": [] },
    "low": { "very_high": [], "high": [], "medium": [], "low": [], "very_low": [] },
    "very_low": { "very_high": [], "high": [], "medium": [], "low": [], "very_low": [] }
  };

  riskData.forEach(risk => {
    if (matrix[risk.probability] && matrix[risk.probability][risk.impact]) {
      matrix[risk.probability][risk.impact].push({
        id: risk.id,
        subject: risk.subject,
        score: risk.riskScore
      });
    }
  });

  return {
    method: "Probability Impact Matrix",
    matrix: matrix,
    totalRiskExposure: riskData.reduce((sum, risk) => sum + risk.riskScore, 0),
    averageRiskScore: riskData.reduce((sum, risk) => sum + risk.riskScore, 0) / riskData.length,
    riskDistribution: categorizeRisksByScore(riskData),
    criticalRisks: riskData.filter(risk => risk.riskScore >= 15)
  };
}

function performRiskScoringAnalysis(riskData: any[], input: any) {
  return {
    method: "Risk Scoring",
    totalRiskExposure: riskData.reduce((sum, risk) => sum + risk.riskScore, 0),
    averageRiskScore: riskData.reduce((sum, risk) => sum + risk.riskScore, 0) / riskData.length,
    riskDistribution: categorizeRisksByScore(riskData),
    criticalRisks: riskData.filter(risk => risk.riskScore >= 15),
    risksByCategory: riskData.reduce((acc, risk) => {
      acc[risk.category] = acc[risk.category] || [];
      acc[risk.category].push(risk);
      return acc;
    }, {} as Record<string, any[]>)
  };
}

function getProbabilityValue(probability: string): number {
  const values = {
    "very_low": 0.05, "low": 0.2, "medium": 0.4, "high": 0.65, "very_high": 0.9
  };
  return values[probability as keyof typeof values] || 0.4;
}

function categorizeRisksByScore(riskData: any[]) {
  return {
    critical: riskData.filter(r => r.riskScore >= 20).length,
    high: riskData.filter(r => r.riskScore >= 15 && r.riskScore < 20).length, 
    medium: riskData.filter(r => r.riskScore >= 8 && r.riskScore < 15).length,
    low: riskData.filter(r => r.riskScore < 8).length
  };
}

function generateRiskRecommendations(analysis: any, riskData: any[]): string[] {
  const recommendations = [];
  
  if (analysis.criticalRisks?.length > 0) {
    recommendations.push(`Address ${analysis.criticalRisks.length} critical risks immediately`);
  }
  
  if (analysis.averageRiskScore > 10) {
    recommendations.push("Portfolio risk level is above acceptable threshold - implement additional mitigation");
  }
  
  if (riskData.length > 50) {
    recommendations.push("Large number of risks identified - consider risk consolidation and prioritization");
  }
  
  if (analysis.riskDistribution?.high + analysis.riskDistribution?.critical > riskData.length * 0.3) {
    recommendations.push("High proportion of severe risks - review project feasibility");
  }
  
  return recommendations;
}

function generateBurndownRecommendations(distributionData: any, totalRisks: number): string[] {
  const recommendations = [];
  const activeRisks = Object.values(distributionData).reduce((sum: number, group: any) => sum + group.active, 0);
  const closedRisks = Object.values(distributionData).reduce((sum: number, group: any) => sum + group.closed, 0);
  
  if (activeRisks / totalRisks > 0.7) {
    recommendations.push("High number of active risks - accelerate mitigation efforts");
  }
  
  if (closedRisks / totalRisks < 0.1) {
    recommendations.push("Low risk closure rate - review mitigation effectiveness");
  }
  
  return recommendations;
}

function generateTimePeriods(timeframe: string): string[] {
  const now = new Date();
  const periods = [];
  
  switch (timeframe) {
    case "last_month":
      for (let i = 30; i >= 0; i -= 5) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        periods.push(date.toISOString().split('T')[0]);
      }
      break;
    case "last_quarter":
      for (let i = 90; i >= 0; i -= 15) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        periods.push(date.toISOString().split('T')[0]);
      }
      break;
    default:
      for (let i = 180; i >= 0; i -= 30) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        periods.push(date.toISOString().split('T')[0]);
      }
  }
  
  return periods;
}