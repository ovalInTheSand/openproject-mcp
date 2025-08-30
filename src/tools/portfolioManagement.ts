// src/tools/portfolioManagement.ts
import { z } from "zod";
import { opFetch, joinUrl } from "../util/op";

// ===== PORTFOLIO MANAGEMENT SCHEMAS =====

// Portfolio Custom Fields Schema
const PortfolioCustomFieldsSchema = z.record(z.string(), z.any()).optional();

const StrategicObjectiveSchema = z.enum([
  "revenue_growth",
  "cost_reduction", 
  "market_expansion",
  "operational_efficiency",
  "digital_transformation",
  "customer_experience",
  "innovation",
  "compliance",
  "sustainability",
  "risk_mitigation"
]);

const OptimizationGoalSchema = z.enum([
  "maximize_roi",
  "minimize_risk", 
  "maximize_value",
  "minimize_cost",
  "maximize_throughput",
  "balance_resources"
]);

// Portfolio Create Schema
export const createPortfolioInput = z.object({
  name: z.string().min(1).max(255),
  identifier: z.string().min(1).max(100).regex(/^[a-z0-9\-_]+$/),
  description: z.string().optional(),
  strategicObjectives: z.array(StrategicObjectiveSchema).optional(),
  budgetTotal: z.number().min(0).optional(),
  portfolioManager: z.union([z.string(), z.number()]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  projectIds: z.array(z.union([z.string(), z.number()])).optional(),
  customFields: PortfolioCustomFieldsSchema,
  active: z.boolean().default(true),
  public: z.boolean().default(false),
  dryRun: z.boolean().default(false)
});

// Portfolio List Schema
export const listProjectsPortfolioInput = z.object({
  portfolioId: z.union([z.string(), z.number()]).optional(),
  includeSubprojects: z.boolean().default(true),
  filters: z.record(z.string(), z.any()).optional(),
  sortBy: z.string().optional(),
  pageSize: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
  includeHierarchy: z.boolean().default(true),
  includeCustomFields: z.boolean().default(true),
  includeStatus: z.boolean().default(true),
  includeBudget: z.boolean().default(true)
});

// Portfolio Resource Balancing Schema
export const balanceResourcesInput = z.object({
  portfolioId: z.union([z.string(), z.number()]),
  timeHorizon: z.enum(["1_month", "3_months", "6_months", "12_months"]).default("3_months"),
  constraints: z.array(z.enum(["budget", "resources", "timeline", "skills"])).optional(),
  optimizationGoal: OptimizationGoalSchema.default("balance_resources"),
  includeProjections: z.boolean().default(true),
  identifyOverallocations: z.boolean().default(true),
  suggestRebalancing: z.boolean().default(true),
  resourceTypes: z.array(z.string()).optional()
});

// Portfolio Health Dashboard Schema
export const generateHealthDashboardInput = z.object({
  portfolioId: z.union([z.string(), z.number()]),
  reportDate: z.string().optional(),
  includeMetrics: z.array(z.enum([
    "roi", 
    "risk_score", 
    "strategic_alignment", 
    "resource_utilization",
    "budget_variance",
    "schedule_variance", 
    "quality_metrics",
    "stakeholder_satisfaction"
  ])).optional(),
  timeframe: z.enum(["current", "last_month", "last_quarter", "ytd"]).default("current"),
  includeTrends: z.boolean().default(true),
  includeForecasts: z.boolean().default(true),
  executiveSummary: z.boolean().default(true)
});

// Portfolio Benefits Tracking Schema
export const trackBenefitsInput = z.object({
  portfolioId: z.union([z.string(), z.number()]),
  benefitType: z.enum([
    "financial",
    "operational", 
    "strategic",
    "customer",
    "regulatory",
    "risk_mitigation"
  ]).optional(),
  trackingPeriod: z.enum(["monthly", "quarterly", "annually"]).default("quarterly"),
  includeRealization: z.boolean().default(true),
  includeProjctions: z.boolean().default(true),
  compareToBaseline: z.boolean().default(true),
  kpis: z.array(z.string()).optional()
});

// ===== PORTFOLIO MANAGEMENT FUNCTIONS =====

export async function createPortfolio(
  ctx: { env: any },
  input: z.infer<typeof createPortfolioInput>
) {
  // Create portfolio as a parent project with portfolio-specific custom fields
  const portfolioData: any = {
    name: input.name,
    identifier: input.identifier,
    description: input.description,
    active: input.active,
    public: input.public,
    ...((input.customFields || {}) as Record<string, any>),
    // Add portfolio-specific custom fields
    customField1: input.strategicObjectives?.join(", "),
    customField2: input.budgetTotal?.toString(),
    customField3: input.portfolioManager?.toString(),
    customField4: input.startDate,
    customField5: input.endDate,
    customField6: "portfolio" // Portfolio type marker
  };

  if (input.dryRun) {
    // Validate via form endpoint
    const { json: formResponse } = await opFetch<any>(ctx.env, "/api/v3/projects/form", {
      method: "POST",
      body: JSON.stringify(portfolioData)
    });

    return {
      dryRun: true,
      validation: formResponse,
      portfolioData,
      message: "Portfolio validation successful - ready for creation"
    };
  }

  // Create the portfolio project
  const { json: response } = await opFetch<any>(ctx.env, "/api/v3/projects", {
    method: "POST", 
    body: JSON.stringify(portfolioData)
  });

  // If project IDs provided, update them to have this portfolio as parent
  if (input.projectIds && input.projectIds.length > 0) {
    const childProjects = [];
    for (const projectId of input.projectIds) {
      try {
        const { json: childResponse } = await opFetch<any>(ctx.env, `/api/v3/projects/${projectId}`, {
          method: "PATCH",
          body: JSON.stringify({
            _links: {
              parent: { href: `/api/v3/projects/${response.id}` }
            }
          })
        });
        childProjects.push(childResponse);
      } catch (error: any) {
        console.warn(`Failed to assign project ${projectId} to portfolio: ${error}`);
      }
    }

    return {
      portfolio: response,
      childProjects,
      message: `Portfolio created with ${childProjects.length} child projects`,
      strategicObjectives: input.strategicObjectives,
      budgetTotal: input.budgetTotal
    };
  }

  return {
    portfolio: response,
    message: "Portfolio project created successfully",
    strategicObjectives: input.strategicObjectives,
    budgetTotal: input.budgetTotal
  };
}

export async function listProjectsPortfolio(
  ctx: { env: any },
  input: z.infer<typeof listProjectsPortfolioInput>
) {
  const queryParams: Record<string, any> = {
    pageSize: input.pageSize,
    offset: input.offset
  };

  // Add hierarchy filtering if portfolio specified
  if (input.portfolioId) {
    queryParams.filters = JSON.stringify([
      {
        "ancestor": {
          "operator": "=",
          "values": [input.portfolioId.toString()]
        }
      }
    ]);
  }

  // Add custom sorting
  if (input.sortBy) {
    queryParams.sortBy = JSON.stringify([[input.sortBy, "asc"]]);
  }

  // Add custom filters
  if (input.filters) {
    const existingFilters = queryParams.filters ? JSON.parse(queryParams.filters) : [];
    Object.entries(input.filters).forEach(([key, value]: [string, any]) => {
      existingFilters.push({
        [key]: {
          "operator": "=", 
          "values": [value.toString()]
        }
      });
    });
    queryParams.filters = JSON.stringify(existingFilters);
  }

  const { json: response } = await opFetch<any>(ctx.env, "/api/v3/projects", {
    params: queryParams
  });

  // Enrich with hierarchy information if requested
  if (input.includeHierarchy && response._embedded?.elements) {
    for (const project of response._embedded.elements) {
      // Add portfolio hierarchy context
      if (project._links?.ancestors?.href) {
        try {
          const { json: ancestorsResponse } = await opFetch<any>(ctx.env, project._links.ancestors.href);
          project._embedded = project._embedded || {};
          project._embedded.portfolioAncestors = ancestorsResponse._embedded?.elements || [];
        } catch (error: any) {
          console.warn(`Failed to fetch ancestors for project ${project.id}: ${error}`);
        }
      }

      // Add child projects if this is a portfolio
      if (input.includeSubprojects && project._links?.children?.href) {
        try {
          const { json: childrenResponse } = await opFetch<any>(ctx.env, project._links.children.href);
          project._embedded = project._embedded || {};
          project._embedded.childProjects = childrenResponse._embedded?.elements || [];
        } catch (error: any) {
          console.warn(`Failed to fetch children for project ${project.id}: ${error}`);
        }
      }
    }
  }

  // Add budget information if requested
  if (input.includeBudget && response._embedded?.elements) {
    for (const project of response._embedded.elements) {
      try {
        const budgetUrl = `/api/v3/projects/${project.id}/budgets`;
        const { json: budgetResponse } = await opFetch<any>(ctx.env, budgetUrl);
        project._embedded = project._embedded || {};
        project._embedded.budgets = budgetResponse._embedded?.elements || [];
      } catch (error: any) {
        // Budgets might not be available for all projects
        console.info(`No budget data for project ${project.id}`);
      }
    }
  }

  return {
    portfolioProjects: response,
    hierarchyIncluded: input.includeHierarchy,
    budgetIncluded: input.includeBudget,
    totalProjects: response.total || 0,
    pagination: {
      offset: input.offset,
      pageSize: input.pageSize,
      hasMore: response._embedded?.elements?.length === input.pageSize
    }
  };
}

export async function balanceResources(
  ctx: { env: any },
  input: z.infer<typeof balanceResourcesInput>
) {
  // Get portfolio and all child projects
  const { json: portfolioResponse } = await opFetch<any>(ctx.env, `/api/v3/projects/${input.portfolioId}`);
  
  // Get all child projects for resource analysis
  const { json: childProjectsResponse } = await opFetch<any>(
    ctx.env, 
    `/api/v3/projects?filters=${JSON.stringify([
      {
        "ancestor": {
          "operator": "=",
          "values": [input.portfolioId.toString()]
        }
      }
    ])}`
  );

  const projects = childProjectsResponse._embedded?.elements || [];
  const resourceAnalysis: any = {
    portfolio: portfolioResponse,
    projects: projects,
    resourceUtilization: {},
    overallocations: [] as any[],
    recommendations: [] as any[],
    constraints: input.constraints || []
  };

  // Analyze resource allocation across projects
  for (const project of projects) {
    try {
      // Get time entries for resource utilization
      const timeEntriesUrl = `/api/v3/time_entries?filters=${JSON.stringify([
        {
          "project": {
            "operator": "=",
            "values": [project.id.toString()]
          }
        }
      ])}`;
      
      const { json: timeEntries } = await opFetch<any>(ctx.env, timeEntriesUrl);
      
      // Get project members for resource capacity
      const membersUrl = `/api/v3/projects/${project.id}/memberships`;
      const { json: members } = await opFetch<any>(ctx.env, membersUrl);
      
      const projectResourceData = {
        project: project,
        timeEntries: timeEntries._embedded?.elements || [],
        members: members._embedded?.elements || [],
        utilization: 0,
        capacity: 0,
        overallocated: false
      };

      // Calculate utilization metrics
      if (projectResourceData.timeEntries.length > 0) {
        const totalHours = projectResourceData.timeEntries.reduce(
          (sum: number, entry: any) => sum + (entry.hours || 0), 
          0
        );
        projectResourceData.utilization = totalHours;
        projectResourceData.capacity = projectResourceData.members.length * 40 * 4; // Assume 40h/week, 4 weeks
        
        if (projectResourceData.utilization > projectResourceData.capacity * 0.9) {
          projectResourceData.overallocated = true;
          resourceAnalysis.overallocations.push({
            projectId: project.id,
            projectName: project.name,
            utilizationRate: (projectResourceData.utilization / projectResourceData.capacity) * 100,
            excessHours: projectResourceData.utilization - projectResourceData.capacity
          });
        }
      }

      resourceAnalysis.resourceUtilization[project.id] = projectResourceData;

    } catch (error: any) {
      console.warn(`Failed to analyze resources for project ${project.id}: ${error}`);
    }
  }

  // Generate rebalancing recommendations if requested
  if (input.suggestRebalancing && resourceAnalysis.overallocations.length > 0) {
    for (const overallocation of resourceAnalysis.overallocations) {
      resourceAnalysis.recommendations.push({
        type: "resource_rebalancing",
        projectId: overallocation.projectId,
        issue: `Project overallocated by ${overallocation.excessHours.toFixed(1)} hours`,
        recommendations: [
          "Consider extending project timeline",
          "Add additional resources to the project",
          "Reduce project scope to match available capacity",
          "Reassign non-critical tasks to other projects"
        ],
        priority: overallocation.utilizationRate > 120 ? "high" : "medium"
      });
    }
  }

  return {
    portfolioResourceAnalysis: resourceAnalysis,
    optimizationGoal: input.optimizationGoal,
    timeHorizon: input.timeHorizon,
    totalProjects: projects.length,
    overallocatedProjects: resourceAnalysis.overallocations.length,
    recommendations: resourceAnalysis.recommendations,
    constraints: input.constraints
  };
}

export async function generateHealthDashboard(
  ctx: { env: any },
  input: z.infer<typeof generateHealthDashboardInput>
) {
  // Get portfolio project
  const { json: portfolioResponse } = await opFetch<any>(ctx.env, `/api/v3/projects/${input.portfolioId}`);
  
  // Get all child projects
  const { json: childProjectsResponse } = await opFetch<any>(
    ctx.env,
    `/api/v3/projects?filters=${JSON.stringify([
      {
        "ancestor": {
          "operator": "=",
          "values": [input.portfolioId.toString()]
        }
      }
    ])}`
  );

  const projects = childProjectsResponse._embedded?.elements || [];
  const dashboard = {
    portfolio: portfolioResponse,
    reportDate: input.reportDate || new Date().toISOString(),
    timeframe: input.timeframe,
    projects: projects,
    metrics: {},
    executiveSummary: {},
    trends: {},
    forecasts: {}
  };

  // Calculate portfolio health metrics
  const metrics = dashboard.metrics as any;
  
  // Strategic alignment analysis
  if (!input.includeMetrics || input.includeMetrics.includes("strategic_alignment")) {
    const alignedProjects = projects.filter(p => 
      p.statusExplanation?.toLowerCase().includes("aligned") || 
      p.status?.name?.toLowerCase() === "on track"
    ).length;
    
    metrics.strategicAlignment = {
      alignedProjects: alignedProjects,
      totalProjects: projects.length,
      alignmentPercentage: projects.length > 0 ? (alignedProjects / projects.length) * 100 : 0,
      status: alignedProjects / projects.length > 0.8 ? "good" : 
              alignedProjects / projects.length > 0.6 ? "warning" : "critical"
    };
  }

  // Project status distribution
  const statusDistribution = projects.reduce((acc, project) => {
    const status = project.status?.name || "unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  metrics.projectHealth = {
    statusDistribution,
    totalProjects: projects.length,
    healthyProjects: (statusDistribution["on track"] || 0) + (statusDistribution["green"] || 0),
    atRiskProjects: (statusDistribution["at risk"] || 0) + (statusDistribution["yellow"] || 0),
    criticalProjects: (statusDistribution["off track"] || 0) + (statusDistribution["red"] || 0)
  };

  // Risk score calculation
  if (!input.includeMetrics || input.includeMetrics.includes("risk_score")) {
    const riskScore = projects.reduce((totalRisk, project) => {
      // Simple risk scoring based on status
      let projectRisk = 0;
      if (project.status?.name?.toLowerCase().includes("risk") || 
          project.status?.name?.toLowerCase().includes("yellow")) {
        projectRisk = 5;
      } else if (project.status?.name?.toLowerCase().includes("track") || 
                 project.status?.name?.toLowerCase().includes("red")) {
        projectRisk = 8;
      } else {
        projectRisk = 2; // On track projects
      }
      return totalRisk + projectRisk;
    }, 0);

    metrics.riskScore = {
      portfolioRiskScore: projects.length > 0 ? riskScore / projects.length : 0,
      totalRiskPoints: riskScore,
      riskLevel: riskScore / projects.length < 3 ? "low" : 
                 riskScore / projects.length < 6 ? "medium" : "high",
      highRiskProjects: projects.filter(p => 
        p.status?.name?.toLowerCase().includes("track") || 
        p.status?.name?.toLowerCase().includes("red")
      ).length
    };
  }

  // Resource utilization (if requested)
  if (!input.includeMetrics || input.includeMetrics.includes("resource_utilization")) {
    let totalMembers = 0;
    let totalTimeEntries = 0;

    for (const project of projects.slice(0, 5)) { // Limit to avoid too many API calls
      try {
        const { json: membersResponse } = await opFetch<any>(ctx.env, `/api/v3/projects/${project.id}/memberships`);
        totalMembers += membersResponse._embedded?.elements?.length || 0;

        const { json: timeEntriesResponse } = await opFetch<any>(
          ctx.env,
          `/api/v3/time_entries?filters=${JSON.stringify([
            {
              "project": {
                "operator": "=",
                "values": [project.id.toString()]
              }
            }
          ])}&pageSize=50`
        );
        totalTimeEntries += timeEntriesResponse._embedded?.elements?.length || 0;
      } catch (error: any) {
        console.warn(`Failed to get resource data for project ${project.id}: ${error}`);
      }
    }

    metrics.resourceUtilization = {
      totalMembers,
      totalTimeEntries,
      averageTimeEntriesPerMember: totalMembers > 0 ? totalTimeEntries / totalMembers : 0,
      utilizationStatus: totalTimeEntries / totalMembers > 20 ? "high" : 
                        totalTimeEntries / totalMembers > 10 ? "medium" : "low"
    };
  }

  // Generate executive summary
  if (input.executiveSummary) {
    dashboard.executiveSummary = {
      portfolioName: portfolioResponse.name,
      totalProjects: projects.length,
      overallHealth: metrics.projectHealth?.healthyProjects > metrics.projectHealth?.atRiskProjects ? 
                     "healthy" : "needs attention",
      keyHighlights: [
        `${metrics.projectHealth?.healthyProjects || 0} projects on track`,
        `${metrics.projectHealth?.atRiskProjects || 0} projects need attention`,
        `Portfolio risk level: ${metrics.riskScore?.riskLevel || "unknown"}`,
        `Resource utilization: ${metrics.resourceUtilization?.utilizationStatus || "unknown"}`
      ],
      recommendedActions: generateRecommendations(metrics)
    };
  }

  return {
    portfolioDashboard: dashboard,
    generatedAt: new Date().toISOString(),
    metricsIncluded: input.includeMetrics || ["all"],
    executiveSummary: dashboard.executiveSummary
  };
}

export async function trackBenefits(
  ctx: { env: any },
  input: z.infer<typeof trackBenefitsInput>
) {
  // Get portfolio project
  const { json: portfolioResponse } = await opFetch<any>(ctx.env, `/api/v3/projects/${input.portfolioId}`);
  
  // Get all child projects for benefits tracking
  const { json: childProjectsResponse } = await opFetch<any>(
    ctx.env,
    `/api/v3/projects?filters=${JSON.stringify([
      {
        "ancestor": {
          "operator": "=",
          "values": [input.portfolioId.toString()]
        }
      }
    ])}`
  );

  const projects = childProjectsResponse._embedded?.elements || [];
  const benefitsTracking = {
    portfolio: portfolioResponse,
    trackingPeriod: input.trackingPeriod,
    benefitType: input.benefitType,
    projects: projects,
    benefitsRealization: {},
    kpiTracking: {},
    projections: {},
    baselineComparison: {}
  };

  // Track benefits across projects
  for (const project of projects) {
    const projectBenefits = {
      projectId: project.id,
      projectName: project.name,
      plannedBenefits: {},
      realizedBenefits: {},
      realizationPercentage: 0,
      status: "tracking"
    };

    // Extract benefits from custom fields (assuming benefits are tracked in custom fields)
    if (project.customFields) {
      Object.entries(project.customFields).forEach(([key, value]: [string, any]) => {
        if (key.toLowerCase().includes("benefit")) {
          projectBenefits.plannedBenefits[key] = value;
        }
      });
    }

    // Calculate realization based on project completion and status
    if (project.percentDone) {
      projectBenefits.realizationPercentage = project.percentDone;
      
      Object.keys(projectBenefits.plannedBenefits).forEach((benefitKey: string) => {
        const plannedValue = projectBenefits.plannedBenefits[benefitKey];
        if (typeof plannedValue === "number") {
          projectBenefits.realizedBenefits[benefitKey] = 
            (plannedValue * projectBenefits.realizationPercentage) / 100;
        }
      });
    }

    benefitsTracking.benefitsRealization[project.id] = projectBenefits;
  }

  // Generate portfolio-level benefits summary
  const portfolioBenefits = {
    totalPlannedValue: 0,
    totalRealizedValue: 0,
    realizationRate: 0,
    benefitsByType: {} as Record<string, any>
  };

  Object.values(benefitsTracking.benefitsRealization).forEach((projectBenefits: any) => {
    Object.entries(projectBenefits.realizedBenefits).forEach(([key, value]: [string, any]) => {
      if (typeof value === "number") {
        portfolioBenefits.totalRealizedValue += value;
        
        if (!portfolioBenefits.benefitsByType[key]) {
          portfolioBenefits.benefitsByType[key] = { planned: 0, realized: 0 };
        }
        portfolioBenefits.benefitsByType[key].realized += value;
      }
    });

    Object.entries(projectBenefits.plannedBenefits).forEach(([key, value]: [string, any]) => {
      if (typeof value === "number") {
        portfolioBenefits.totalPlannedValue += value;
        
        if (!portfolioBenefits.benefitsByType[key]) {
          portfolioBenefits.benefitsByType[key] = { planned: 0, realized: 0 };
        }
        portfolioBenefits.benefitsByType[key].planned += value;
      }
    });
  });

  portfolioBenefits.realizationRate = portfolioBenefits.totalPlannedValue > 0 ? 
    (portfolioBenefits.totalRealizedValue / portfolioBenefits.totalPlannedValue) * 100 : 0;

  // Generate projections if requested
  if (input.includeProjctions) {
    benefitsTracking.projections = {
      projectedRealization: portfolioBenefits.realizationRate,
      estimatedCompletionValue: portfolioBenefits.totalPlannedValue,
      projectionConfidence: portfolioBenefits.realizationRate > 80 ? "high" : 
                           portfolioBenefits.realizationRate > 60 ? "medium" : "low",
      riskFactors: portfolioBenefits.realizationRate < 70 ? [
        "Below target realization rate",
        "May require intervention to achieve planned benefits"
      ] : []
    };
  }

  return {
    benefitsTracking: benefitsTracking,
    portfolioBenefits: portfolioBenefits,
    trackingPeriod: input.trackingPeriod,
    totalProjects: projects.length,
    realizationSummary: {
      onTrack: Object.values(benefitsTracking.benefitsRealization).filter(
        (b: any) => b.realizationPercentage >= 80
      ).length,
      needsAttention: Object.values(benefitsTracking.benefitsRealization).filter(
        (b: any) => b.realizationPercentage < 60
      ).length
    }
  };
}

// Helper function for generating recommendations
function generateRecommendations(metrics: any): string[] {
  const recommendations = [];
  
  if (metrics.riskScore?.riskLevel === "high") {
    recommendations.push("Focus on risk mitigation for high-risk projects");
  }
  
  if (metrics.projectHealth?.atRiskProjects > metrics.projectHealth?.healthyProjects) {
    recommendations.push("Implement additional project support for at-risk initiatives");
  }
  
  if (metrics.resourceUtilization?.utilizationStatus === "high") {
    recommendations.push("Consider resource rebalancing across portfolio");
  }
  
  if (metrics.strategicAlignment?.alignmentPercentage < 70) {
    recommendations.push("Review strategic alignment of portfolio projects");
  }
  
  return recommendations;
}