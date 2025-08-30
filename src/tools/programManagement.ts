// src/tools/programManagement.ts
import { z } from "zod";
import { opFetch, joinUrl } from "../util/op";

// ===== PROGRAM MANAGEMENT SCHEMAS =====

const BenefitTypeSchema = z.enum([
  "financial",
  "operational", 
  "strategic",
  "customer_satisfaction",
  "risk_reduction",
  "compliance",
  "innovation",
  "market_position",
  "efficiency",
  "quality_improvement"
]);

const ProgramStatusSchema = z.enum([
  "initiation",
  "planning", 
  "execution",
  "monitoring",
  "closing",
  "on_hold",
  "cancelled"
]);

const StakeholderRoleSchema = z.enum([
  "program_manager",
  "sponsor",
  "steering_committee",
  "project_manager",
  "business_owner",
  "end_user",
  "subject_matter_expert",
  "governance_board"
]);

const BenefitStatusSchema = z.enum([
  "planned",
  "in_progress", 
  "realized",
  "at_risk",
  "missed",
  "deferred"
]);

const DeliveryCoordinationTypeSchema = z.enum([
  "sequence_dependencies",
  "parallel_coordination",
  "milestone_alignment", 
  "resource_sharing",
  "integration_points",
  "risk_mitigation"
]);

// Program Custom Fields Schema
const ProgramCustomFieldsSchema = z.record(z.string(), z.any()).optional();

// Create Program Schema
export const createProgramInput = z.object({
  name: z.string().min(1).max(255),
  identifier: z.string().min(1).max(100).regex(/^[a-z0-9\-_]+$/),
  description: z.string().optional(),
  programManager: z.union([z.string(), z.number()]).optional(),
  sponsor: z.union([z.string(), z.number()]).optional(),
  projects: z.array(z.union([z.string(), z.number()])),
  expectedBenefits: z.array(z.object({
    type: BenefitTypeSchema,
    description: z.string(),
    measurementCriteria: z.string(),
    targetValue: z.string(),
    targetDate: z.string().optional()
  })).optional(),
  strategicObjectives: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().min(0).optional(),
  riskTolerance: z.enum(["low", "medium", "high"]).default("medium"),
  governanceLevel: z.enum(["basic", "standard", "enhanced"]).default("standard"),
  customFields: ProgramCustomFieldsSchema,
  active: z.boolean().default(true),
  dryRun: z.boolean().default(false)
});

// Coordinate Deliveries Schema
export const coordinateDeliveriesInput = z.object({
  programId: z.union([z.string(), z.number()]),
  coordinationType: DeliveryCoordinationTypeSchema.default("milestone_alignment"),
  includeProjectDependencies: z.boolean().default(true),
  includeMilestoneAlignment: z.boolean().default(true),
  includeResourceConflicts: z.boolean().default(true),
  includeRiskFactors: z.boolean().default(true),
  timeHorizon: z.enum(["1_month", "3_months", "6_months", "program_duration"]).default("6_months"),
  generateActionPlan: z.boolean().default(true),
  prioritizeBy: z.enum(["business_value", "risk_level", "timeline_critical", "resource_impact"]).default("business_value")
});

// Track Benefits Schema
export const trackProgramBenefitsInput = z.object({
  programId: z.union([z.string(), z.number()]),
  reportingPeriod: z.enum(["monthly", "quarterly", "semi_annual", "annual"]).default("quarterly"),
  benefitTypes: z.array(BenefitTypeSchema).optional(),
  includeRealizationRate: z.boolean().default(true),
  includeProjectContribution: z.boolean().default(true),
  includeForecast: z.boolean().default(true),
  includeRiskAssessment: z.boolean().default(true),
  baselineDate: z.string().optional(),
  comparisonBenchmark: z.enum(["baseline", "industry_standard", "organizational_target"]).default("baseline")
});

// Manage Stakeholders Schema
export const manageProgramStakeholdersInput = z.object({
  programId: z.union([z.string(), z.number()]),
  includeStakeholderRegister: z.boolean().default(true),
  includeInfluenceMapping: z.boolean().default(true),
  includeEngagementPlan: z.boolean().default(true),
  includeCommunicationMatrix: z.boolean().default(true),
  stakeholderCategories: z.array(StakeholderRoleSchema).optional(),
  engagementLevel: z.enum(["minimal", "standard", "intensive"]).default("standard"),
  communicationFrequency: z.enum(["weekly", "bi_weekly", "monthly", "quarterly"]).default("bi_weekly"),
  generateSatisfactionSurvey: z.boolean().default(false)
});

// ===== PROGRAM MANAGEMENT FUNCTIONS =====

export async function createProgram(
  ctx: { env: any },
  input: z.infer<typeof createProgramInput>
) {
  // Create program as a special parent project with program-specific attributes
  const programData: any = {
    name: input.name,
    identifier: input.identifier,
    description: input.description,
    active: input.active,
    public: false, // Programs are typically internal
    // Program-specific custom fields
    customField1: input.programManager?.toString(),
    customField2: input.sponsor?.toString(),
    customField3: JSON.stringify(input.strategicObjectives || []),
    customField4: input.budget?.toString(),
    customField5: input.riskTolerance,
    customField6: input.governanceLevel,
    customField7: "program", // Program type marker
    customField8: JSON.stringify(input.expectedBenefits || []),
    customField9: input.startDate,
    customField10: input.endDate,
    ...((input.customFields || {}) as Record<string, any>)
  };

  if (input.dryRun) {
    // Validate via form endpoint
    const { json: formResponse } = await opFetch<any>(ctx.env, "/api/v3/projects/form", {
      method: "POST",
      body: JSON.stringify(programData)
    });

    return {
      dryRun: true,
      validation: formResponse,
      programData,
      projectsToLink: input.projects,
      message: "Program validation successful - ready for creation"
    };
  }

  // Create the program project
  const { json: programResponse } = await opFetch<any>(ctx.env, "/api/v3/projects", {
    method: "POST",
    body: JSON.stringify(programData)
  });

  // Link child projects to the program
  const linkedProjects = [];
  const failedLinks = [];

  for (const projectId of input.projects) {
    try {
      // Get current project to get lockVersion
      const { json: currentProject } = await opFetch<any>(ctx.env, `/api/v3/projects/${projectId}`);
      
      // Update project to set program as parent
      const { json: updateResponse } = await opFetch<any>(ctx.env, `/api/v3/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          lockVersion: currentProject.lockVersion,
          _links: {
            parent: { href: `/api/v3/projects/${programResponse.id}` }
          }
        })
      });
      
      linkedProjects.push({
        projectId: projectId,
        projectName: updateResponse.name,
        linkedSuccessfully: true
      });
    } catch (error: any) {
      console.warn(`Failed to link project ${projectId} to program: ${error}`);
      failedLinks.push({
        projectId: projectId,
        error: error,
        reason: "Could not establish parent-child relationship"
      });
    }
  }

  // Create initial program coordination framework
  const coordinationFramework = await initializeProgramCoordination(
    ctx.env,
    programResponse.id,
    linkedProjects
  );

  return {
    program: programResponse,
    linkedProjects: linkedProjects,
    failedLinks: failedLinks,
    coordinationFramework: coordinationFramework,
    expectedBenefits: input.expectedBenefits,
    strategicObjectives: input.strategicObjectives,
    message: `Program created with ${linkedProjects.length}/${input.projects.length} projects linked successfully`
  };
}

export async function coordinateDeliveries(
  ctx: { env: any },
  input: z.infer<typeof coordinateDeliveriesInput>
) {
  // Get program project
  const { json: programResponse } = await opFetch<any>(ctx.env, `/api/v3/projects/${input.programId}`);
  
  // Get all child projects
  const params: any = {
    filters: JSON.stringify([
      {
        "parent": {
          "operator": "=",
          "values": [input.programId.toString()]
        }
      }
    ])
  };
  const { json: childProjectsResponse } = await opFetch<any>(ctx.env, "/api/v3/projects", { params });

  const childProjects = childProjectsResponse._embedded?.elements || [];
  
  if (childProjects.length === 0) {
    return {
      coordination: null,
      message: "No child projects found for coordination",
      recommendations: ["Add projects to the program before coordinating deliveries"]
    };
  }

  const coordination = {
    program: programResponse,
    projects: childProjects,
    deliveryCoordination: {},
    dependencies: [],
    milestoneAlignment: {},
    resourceConflicts: [],
    riskFactors: [],
    actionPlan: []
  };

  // Analyze project dependencies if requested
  if (input.includeProjectDependencies) {
    coordination.dependencies = await analyzeInterProjectDependencies(
      ctx.env,
      childProjects
    );
  }

  // Analyze milestone alignment if requested
  if (input.includeMilestoneAlignment) {
    coordination.milestoneAlignment = await analyzeMilestoneAlignment(
      ctx.env,
      childProjects,
      input.timeHorizon
    );
  }

  // Identify resource conflicts if requested
  if (input.includeResourceConflicts) {
    coordination.resourceConflicts = await identifyResourceConflicts(
      ctx.env,
      childProjects
    );
  }

  // Assess coordination risk factors if requested
  if (input.includeRiskFactors) {
    coordination.riskFactors = await assessCoordinationRisks(
      childProjects,
      coordination.dependencies,
      coordination.resourceConflicts
    );
  }

  // Generate action plan if requested
  if (input.generateActionPlan) {
    coordination.actionPlan = generateCoordinationActionPlan(
      coordination,
      input.prioritizeBy,
      input.coordinationType
    );
  }

  // Generate coordination recommendations
  const recommendations = generateCoordinationRecommendations(
    coordination,
    input.coordinationType
  );

  return {
    deliveryCoordination: coordination,
    coordinationType: input.coordinationType,
    timeHorizon: input.timeHorizon,
    totalProjects: childProjects.length,
    dependenciesIdentified: coordination.dependencies.length,
    conflictsIdentified: coordination.resourceConflicts.length,
    actionItemsGenerated: coordination.actionPlan.length,
    recommendations: recommendations
  };
}

export async function trackProgramBenefits(
  ctx: { env: any },
  input: z.infer<typeof trackProgramBenefitsInput>
) {
  // Get program project with benefits information
  const { json: programResponse } = await opFetch<any>(ctx.env, `/api/v3/projects/${input.programId}`);
  
  // Extract expected benefits from program custom fields
  const expectedBenefits = programResponse.customField8 ? 
    JSON.parse(programResponse.customField8) : [];

  // Get all child projects for benefit analysis
  const params2: any = {
    filters: JSON.stringify([
      {
        "parent": {
          "operator": "=",
          "values": [input.programId.toString()]
        }
      }
    ])
  };
  const { json: childProjectsResponse } = await opFetch<any>(ctx.env, "/api/v3/projects", { params: params2 });

  const childProjects = childProjectsResponse._embedded?.elements || [];
  
  const benefitsTracking = {
    program: programResponse,
    reportingPeriod: input.reportingPeriod,
    expectedBenefits: expectedBenefits,
    benefitRealization: {},
    projectContributions: [],
    realizationSummary: {},
    forecast: {},
    riskAssessment: {}
  };

  // Track benefit realization for each expected benefit
  for (const expectedBenefit of expectedBenefits) {
    const benefitTracking = {
      benefitType: expectedBenefit.type,
      description: expectedBenefit.description,
      targetValue: expectedBenefit.targetValue,
      measurementCriteria: expectedBenefit.measurementCriteria,
      currentValue: "0", // Would need actual measurement
      realizationPercentage: 0,
      status: "in_progress" as z.infer<typeof BenefitStatusSchema>,
      contributingProjects: [],
      riskFactors: []
    };

    // Analyze project contributions to this benefit
    if (input.includeProjectContribution) {
      for (const project of childProjects) {
        const contribution = analyzeBenefitContribution(
          project,
          expectedBenefit,
          input.reportingPeriod
        );
        
        if (contribution.contributionLevel > 0) {
          benefitTracking.contributingProjects.push(contribution);
          benefitTracking.realizationPercentage += contribution.contributionLevel;
        }
      }
    }

    // Calculate realization percentage based on project progress
    if (benefitTracking.contributingProjects.length > 0) {
      const avgContribution = benefitTracking.contributingProjects.reduce(
        (sum, contrib) => sum + contrib.contributionLevel, 0
      ) / benefitTracking.contributingProjects.length;
      
      benefitTracking.realizationPercentage = Math.min(100, avgContribution);
      
      // Update benefit status based on realization
      if (benefitTracking.realizationPercentage >= 90) {
        benefitTracking.status = "realized";
      } else if (benefitTracking.realizationPercentage >= 60) {
        benefitTracking.status = "in_progress";
      } else if (benefitTracking.realizationPercentage < 30) {
        benefitTracking.status = "at_risk";
      }
    }

    benefitsTracking.benefitRealization[expectedBenefit.type] = benefitTracking;
  }

  // Generate realization summary
  if (input.includeRealizationRate) {
    const totalBenefits = Object.keys(benefitsTracking.benefitRealization).length;
    const realizedBenefits = Object.values(benefitsTracking.benefitRealization)
      .filter((b: any) => b.status === "realized").length;
    const atRiskBenefits = Object.values(benefitsTracking.benefitRealization)
      .filter((b: any) => b.status === "at_risk").length;

    benefitsTracking.realizationSummary = {
      totalBenefits: totalBenefits,
      realizedBenefits: realizedBenefits,
      atRiskBenefits: atRiskBenefits,
      realizationRate: totalBenefits > 0 ? (realizedBenefits / totalBenefits) * 100 : 0,
      overallStatus: realizedBenefits / totalBenefits > 0.8 ? "on_track" : 
                     realizedBenefits / totalBenefits > 0.5 ? "needs_attention" : "at_risk"
    };
  }

  // Generate forecast if requested
  if (input.includeForecast) {
    benefitsTracking.forecast = generateBenefitForecast(
      benefitsTracking.benefitRealization,
      childProjects
    );
  }

  // Assess risks if requested
  if (input.includeRiskAssessment) {
    benefitsTracking.riskAssessment = assessBenefitRisks(
      benefitsTracking.benefitRealization,
      childProjects
    );
  }

  return {
    benefitsTracking: benefitsTracking,
    reportingDate: new Date().toISOString(),
    totalExpectedBenefits: expectedBenefits.length,
    projectsAnalyzed: childProjects.length,
    realizationRate: (benefitsTracking.realizationSummary as any)?.realizationRate ?? 0,
    overallStatus: (benefitsTracking.realizationSummary as any)?.overallStatus ?? "unknown"
  };
}

export async function manageProgramStakeholders(
  ctx: { env: any },
  input: z.infer<typeof manageProgramStakeholdersInput>
) {
  // Get program project
  const { json: programResponse } = await opFetch<any>(ctx.env, `/api/v3/projects/${input.programId}`);
  
  // Get program membership information
  const { json: membershipsResponse } = await opFetch<any>(
    ctx.env, 
    `/api/v3/projects/${input.programId}/memberships`
  );
  
  const memberships = membershipsResponse._embedded?.elements || [];

  // Get child projects for comprehensive stakeholder view
  const params3: any = {
    filters: JSON.stringify([
      {
        "parent": {
          "operator": "=",
          "values": [input.programId.toString()]
        }
      }
    ])
  };
  const { json: childProjectsResponse } = await opFetch<any>(ctx.env, "/api/v3/projects", { params: params3 });

  const childProjects = childProjectsResponse._embedded?.elements || [];
  
  const stakeholderManagement = {
    program: programResponse,
    stakeholderRegister: [],
    influenceMapping: {},
    engagementPlan: {},
    communicationMatrix: {},
    satisfactionMetrics: {}
  };

  // Build stakeholder register if requested
  if (input.includeStakeholderRegister) {
    stakeholderManagement.stakeholderRegister = await buildStakeholderRegister(
      ctx.env,
      memberships,
      childProjects,
      input.stakeholderCategories
    );
  }

  // Create influence mapping if requested
  if (input.includeInfluenceMapping) {
    stakeholderManagement.influenceMapping = createInfluenceMapping(
      stakeholderManagement.stakeholderRegister,
      programResponse
    );
  }

  // Develop engagement plan if requested
  if (input.includeEngagementPlan) {
    stakeholderManagement.engagementPlan = developEngagementPlan(
      stakeholderManagement.stakeholderRegister,
      input.engagementLevel,
      input.communicationFrequency
    );
  }

  // Create communication matrix if requested
  if (input.includeCommunicationMatrix) {
    stakeholderManagement.communicationMatrix = createCommunicationMatrix(
      stakeholderManagement.stakeholderRegister,
      input.communicationFrequency
    );
  }

  // Generate satisfaction survey if requested
  if (input.generateSatisfactionSurvey) {
    stakeholderManagement.satisfactionMetrics = generateSatisfactionSurvey(
      stakeholderManagement.stakeholderRegister,
      programResponse
    );
  }

  // Generate stakeholder management recommendations
  const recommendations = generateStakeholderRecommendations(
    stakeholderManagement,
    input.engagementLevel
  );

  return {
    stakeholderManagement: stakeholderManagement,
    totalStakeholders: stakeholderManagement.stakeholderRegister.length,
    engagementLevel: input.engagementLevel,
    communicationFrequency: input.communicationFrequency,
    projectsCovered: childProjects.length + 1, // +1 for program itself
    recommendations: recommendations,
    managementDate: new Date().toISOString()
  };
}

// ===== HELPER FUNCTIONS =====

async function initializeProgramCoordination(env: any, programId: string | number, projects: any[]) {
  // Initialize basic coordination framework
  return {
    programId: programId,
    coordinationModel: "hierarchical",
    governanceStructure: {
      steeringCommittee: "program_sponsor",
      programBoard: "monthly_reviews", 
      projectManagers: "bi_weekly_sync"
    },
    communicationPlan: {
      frequency: "bi_weekly",
      format: "structured_reports",
      escalationPath: "defined"
    },
    projectCount: projects.length,
    coordinationStatus: "initialized"
  };
}

async function analyzeInterProjectDependencies(env: any, projects: any[]) {
  const dependencies = [];
  
  // Analyze dependencies between projects by looking at work package relations
  for (const project of projects) {
    try {
      // Get work packages for this project
      const wpParams: any = {
        filters: JSON.stringify([
          {
            "project": {
              "operator": "=",
              "values": [project.id.toString()]
            }
          }
        ]),
        pageSize: 50
      };
      const { json: wpResponse } = await opFetch<any>(env, "/api/v3/work_packages", { params: wpParams });

      const workPackages = wpResponse._embedded?.elements || [];

      // Check for relations to work packages in other projects
      for (const wp of workPackages.slice(0, 10)) { // Limit to avoid too many API calls
        try {
          const relParams: any = {
            filters: JSON.stringify([
              {
                "from": {
                  "operator": "=",
                  "values": [wp.id.toString()]
                }
              }
            ])
          };
          const { json: relationsResponse } = await opFetch<any>(env, "/api/v3/relations", { params: relParams });

          const relations = relationsResponse._embedded?.elements || [];
          
          for (const relation of relations) {
            if (relation._links?.to?.href) {
              try {
                const { json: relatedWP } = await opFetch<any>(env, relation._links.to.href);
                if (relatedWP.project?.id && relatedWP.project.id !== project.id) {
                  dependencies.push({
                    fromProject: project.id,
                    fromProjectName: project.name,
                    toProject: relatedWP.project.id,
                    toProjectName: relatedWP.project.name || "Unknown",
                    dependencyType: relation.type,
                    fromWorkPackage: wp.subject,
                    toWorkPackage: relatedWP.subject,
                    riskLevel: relation.type === "blocks" ? "high" : "medium"
                  });
                }
              } catch (error: any) {
                console.warn("Failed to fetch related work package:", error);
              }
            }
          }
        } catch (error: any) {
          console.warn(`Failed to fetch relations for WP ${wp.id}:`, error);
        }
      }
    } catch (error: any) {
      console.warn(`Failed to analyze dependencies for project ${project.id}:`, error);
    }
  }
  
  return dependencies;
}

async function analyzeMilestoneAlignment(env: any, projects: any[], timeHorizon: string) {
  const alignment = {
    projects: [],
    conflictingMilestones: [],
    alignmentOpportunities: [],
    recommendedSequencing: []
  };

  // Analyze milestones (versions) for each project
  for (const project of projects) {
    try {
      const { json: versionsResponse } = await opFetch<any>(env, `/api/v3/projects/${project.id}/versions`);
      const versions = versionsResponse._embedded?.elements || [];

      const projectMilestones = versions.map((version: any) => ({
        projectId: project.id,
        projectName: project.name,
        milestoneName: version.name,
        startDate: version.startDate,
        endDate: version.endDate,
        status: version.status
      }));

      alignment.projects.push({
        projectId: project.id,
        projectName: project.name,
        milestones: projectMilestones
      });

      // Look for potential conflicts (overlapping critical milestones)
      projectMilestones.forEach((milestone: any) => {
        if (milestone.endDate) {
          const conflictingProjects = alignment.projects.filter((p: any) => 
            p.projectId !== project.id && 
            p.milestones.some((m: any) => m.endDate === milestone.endDate)
          );
          
          if (conflictingProjects.length > 0) {
            alignment.conflictingMilestones.push({
              date: milestone.endDate,
              conflictingMilestones: [
                { project: project.name, milestone: milestone.milestoneName },
                ...conflictingProjects.flatMap(p => 
                  p.milestones
                    .filter(m => m.endDate === milestone.endDate)
                    .map(m => ({ project: p.projectName, milestone: m.milestoneName }))
                )
              ]
            });
          }
        }
      });
    } catch (error: any) {
      console.warn(`Failed to analyze milestones for project ${project.id}:`, error);
    }
  }

  return alignment;
}

async function identifyResourceConflicts(env: any, projects: any[]) {
  const conflicts = [];
  const resourceMap = new Map();

  // Analyze team memberships across projects
  for (const project of projects) {
    try {
      const { json: membershipsResponse } = await opFetch<any>(env, `/api/v3/projects/${project.id}/memberships`);
      const memberships = membershipsResponse._embedded?.elements || [];

      memberships.forEach((membership: any) => {
        const userId = membership._links?.user?.href;
        if (userId) {
          if (!resourceMap.has(userId)) {
            resourceMap.set(userId, []);
          }
          resourceMap.get(userId).push({
            projectId: project.id,
            projectName: project.name,
            roles: membership._links?.roles?.map((r: any) => r.title) || []
          });
        }
      });
    } catch (error: any) {
      console.warn(`Failed to analyze resources for project ${project.id}:`, error);
    }
  }

  // Identify users assigned to multiple projects (potential conflicts)
  resourceMap.forEach((projectAssignments: any, userId: string) => {
    if (projectAssignments.length > 1) {
      conflicts.push({
        resourceId: userId,
        conflictType: "multi_project_assignment",
        conflictLevel: projectAssignments.length > 3 ? "high" : "medium",
        projects: projectAssignments,
        recommendedAction: "Review resource allocation and priorities"
      });
    }
  });

  return conflicts;
}

async function assessCoordinationRisks(projects: any[], dependencies: any[], resourceConflicts: any[]) {
  const risks = [];

  // Risk: High number of dependencies
  if (dependencies.length > projects.length * 2) {
    risks.push({
      riskType: "coordination_complexity",
      severity: "high",
      description: "High number of inter-project dependencies may create coordination challenges",
      impact: "Schedule delays and increased management overhead",
      mitigation: "Implement structured dependency management process"
    });
  }

  // Risk: Critical resource conflicts
  const criticalConflicts = resourceConflicts.filter(c => c.conflictLevel === "high");
  if (criticalConflicts.length > 0) {
    risks.push({
      riskType: "resource_overallocation",
      severity: "high", 
      description: `${criticalConflicts.length} critical resource conflicts identified`,
      impact: "Resource burnout and project delays",
      mitigation: "Rebalance resource allocation across projects"
    });
  }

  // Risk: Too many projects for effective coordination
  if (projects.length > 10) {
    risks.push({
      riskType: "program_scale_complexity",
      severity: "medium",
      description: "Large number of projects may exceed manageable coordination capacity",
      impact: "Reduced oversight and coordination effectiveness",
      mitigation: "Consider sub-program organization or portfolio restructuring"
    });
  }

  return risks;
}

function generateCoordinationActionPlan(coordination: any, prioritizeBy: string, coordinationType: string) {
  const actionPlan = [];

  // Actions based on dependencies
  if (coordination.dependencies.length > 0) {
    const highRiskDeps = coordination.dependencies.filter((d: any) => d.riskLevel === "high");
    if (highRiskDeps.length > 0) {
      actionPlan.push({
        priority: "high",
        action: "Address critical inter-project dependencies",
        description: `Resolve ${highRiskDeps.length} high-risk dependencies to prevent schedule impacts`,
        owner: "program_manager",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        category: "dependency_management"
      });
    }
  }

  // Actions based on resource conflicts
  if (coordination.resourceConflicts.length > 0) {
    const criticalConflicts = coordination.resourceConflicts.filter((c: any) => c.conflictLevel === "high");
    if (criticalConflicts.length > 0) {
      actionPlan.push({
        priority: "high",
        action: "Resolve critical resource conflicts",
        description: `Address resource overallocation affecting ${criticalConflicts.length} team members`,
        owner: "program_manager",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        category: "resource_management"
      });
    }
  }

  // Actions based on milestone alignment
  if (coordination.milestoneAlignment?.conflictingMilestones?.length > 0) {
    actionPlan.push({
      priority: "medium",
      action: "Align conflicting project milestones",
      description: "Resolve milestone scheduling conflicts to optimize program delivery",
      owner: "project_managers",
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      category: "milestone_management"
    });
  }

  // Sort by priority if specified
  if (prioritizeBy === "risk_level") {
    actionPlan.sort((a, b) => {
      const priorityOrder = { "high": 3, "medium": 2, "low": 1 };
      return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
             (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
    });
  }

  return actionPlan;
}

function generateCoordinationRecommendations(coordination: any, coordinationType: string) {
  const recommendations = [];

  if (coordination.projects.length > 8) {
    recommendations.push("Consider establishing sub-programs for better management of large program scale");
  }

  if (coordination.dependencies.length > coordination.projects.length) {
    recommendations.push("Implement formal dependency management process with regular review cycles");
  }

  if (coordination.resourceConflicts.length > 0) {
    recommendations.push("Establish resource allocation governance to prevent overcommitment");
  }

  if (coordination.riskFactors.length > 3) {
    recommendations.push("Enhance program risk management with proactive monitoring and mitigation");
  }

  return recommendations;
}

function analyzeBenefitContribution(project: any, expectedBenefit: any, reportingPeriod: string) {
  // Analyze how much this project contributes to the expected benefit
  // This is a simplified analysis - in reality would need more sophisticated measurement
  
  const contribution = {
    projectId: project.id,
    projectName: project.name,
    benefitType: expectedBenefit.type,
    contributionLevel: 0, // Percentage contribution
    status: project.status?.name || "active",
    progress: project.percentDone || 0
  };

  // Simple contribution calculation based on project progress and alignment
  // In reality, this would need specific measurement criteria and data collection
  if (project.percentDone) {
    contribution.contributionLevel = project.percentDone;
  }

  // Adjust based on project status
  if (project.status?.name?.toLowerCase().includes("closed")) {
    contribution.contributionLevel = Math.min(100, contribution.contributionLevel + 10);
  } else if (project.status?.name?.toLowerCase().includes("risk")) {
    contribution.contributionLevel = Math.max(0, contribution.contributionLevel - 20);
  }

  return contribution;
}

function generateBenefitForecast(benefitRealization: any, projects: any[]) {
  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => 
    p.status?.name?.toLowerCase().includes("closed") || p.percentDone === 100
  ).length;

  const programProgress = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;

  return {
    forecastDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 3 months from now
    projectedRealizationRate: Math.min(100, programProgress + 10), // Slightly optimistic
    confidence: programProgress > 50 ? "medium" : "low",
    keyAssumptions: [
      "Current project progress rates continue",
      "No major scope changes or resource constraints", 
      "Benefit measurement criteria remain valid"
    ],
    riskFactors: [
      "External market conditions may affect benefit realization",
      "Organizational change management effectiveness",
      "Technology adoption rates by end users"
    ]
  };
}

function assessBenefitRisks(benefitRealization: any, projects: any[]) {
  const risks = [];
  
  const atRiskBenefits = Object.values(benefitRealization).filter((b: any) => b.status === "at_risk");
  
  if (atRiskBenefits.length > 0) {
    risks.push({
      riskType: "benefit_realization",
      severity: "high",
      description: `${atRiskBenefits.length} expected benefits are at risk of not being realized`,
      mitigation: "Review project alignment with benefit objectives and adjust approach"
    });
  }

  const projectsAtRisk = projects.filter(p => 
    p.status?.name?.toLowerCase().includes("risk") || 
    p.status?.name?.toLowerCase().includes("red")
  );

  if (projectsAtRisk.length > projects.length * 0.3) {
    risks.push({
      riskType: "project_delivery",
      severity: "medium",
      description: "High proportion of projects showing risk indicators",
      mitigation: "Implement enhanced project support and monitoring"
    });
  }

  return risks;
}

async function buildStakeholderRegister(
  env: any, 
  memberships: any[], 
  childProjects: any[], 
  categories?: string[]
) {
  const stakeholderRegister = [];
  const uniqueStakeholders = new Map();

  // Add program-level stakeholders
  memberships.forEach((membership: any) => {
    const userId = membership._links?.user?.href;
    const user = membership._embedded?.user;
    
    if (userId && user && !uniqueStakeholders.has(userId)) {
      uniqueStakeholders.set(userId, {
        id: user.id,
        name: user.name,
        email: user.email,
        role: "program_stakeholder",
        influence: "medium",
        interest: "high",
        projects: ["program"],
        engagementLevel: "active",
        communicationPreference: "email",
        lastEngagement: membership.updatedAt
      });
    }
  });

  // Add project-level stakeholders
  for (const project of childProjects.slice(0, 5)) { // Limit to avoid too many API calls
    try {
      const { json: projectMemberships } = await opFetch<any>(env, `/api/v3/projects/${project.id}/memberships`);
      const members = projectMemberships._embedded?.elements || [];
      
      members.forEach((membership: any) => {
        const userId = membership._links?.user?.href;
        const user = membership._embedded?.user;
        
        if (userId && user) {
          if (uniqueStakeholders.has(userId)) {
            // Add this project to existing stakeholder
            const existing = uniqueStakeholders.get(userId);
            existing.projects.push(project.name);
            existing.role = existing.role === "program_stakeholder" ? "program_and_project_stakeholder" : existing.role;
          } else {
            uniqueStakeholders.set(userId, {
              id: user.id,
              name: user.name,
              email: user.email,
              role: "project_stakeholder",
              influence: "medium",
              interest: "medium",
              projects: [project.name],
              engagementLevel: "active",
              communicationPreference: "email",
              lastEngagement: membership.updatedAt
            });
          }
        }
      });
    } catch (error: any) {
      console.warn(`Failed to fetch memberships for project ${project.id}:`, error);
    }
  }

  return Array.from(uniqueStakeholders.values());
}

function createInfluenceMapping(stakeholderRegister: any[], program: any) {
  return {
    highInfluenceHighInterest: stakeholderRegister.filter((s: any) => s.influence === "high" && s.interest === "high"),
    highInfluenceLowInterest: stakeholderRegister.filter((s: any) => s.influence === "high" && s.interest === "low"),
    lowInfluenceHighInterest: stakeholderRegister.filter((s: any) => s.influence === "low" && s.interest === "high"),
    lowInfluenceLowInterest: stakeholderRegister.filter((s: any) => s.influence === "low" && s.interest === "low"),
    engagementStrategies: {
      "high_influence_high_interest": "Manage closely - key supporters",
      "high_influence_low_interest": "Keep satisfied - potential risks",
      "low_influence_high_interest": "Keep informed - advocates",
      "low_influence_low_interest": "Monitor - minimal effort"
    }
  };
}

function developEngagementPlan(stakeholderRegister: any[], engagementLevel: string, frequency: string) {
  return {
    engagementLevel: engagementLevel,
    communicationFrequency: frequency,
    stakeholderSegments: [
      {
        segment: "Executive Sponsors",
        stakeholders: stakeholderRegister.filter((s: any) => s.role.includes("sponsor") || s.influence === "high"),
        engagementApproach: "Executive briefings and decision points",
        frequency: "monthly"
      },
      {
        segment: "Project Managers",
        stakeholders: stakeholderRegister.filter((s: any) => s.role.includes("manager")),
        engagementApproach: "Regular coordination meetings and status updates",
        frequency: frequency
      },
      {
        segment: "Team Members",
        stakeholders: stakeholderRegister.filter((s: any) => s.role === "project_stakeholder"),
        engagementApproach: "Team communications and progress sharing",
        frequency: "bi_weekly"
      }
    ],
    escalationProcess: "Defined escalation path for issues and decisions"
  };
}

function createCommunicationMatrix(stakeholderRegister: any[], frequency: string) {
  return {
    communicationChannels: [
      {
        channel: "Program Status Report",
        audience: stakeholderRegister.filter((s: any) => s.influence === "high" || s.interest === "high"),
        frequency: frequency,
        format: "Written report with executive summary"
      },
      {
        channel: "Project Coordination Meeting", 
        audience: stakeholderRegister.filter((s: any) => s.role.includes("manager")),
        frequency: frequency,
        format: "Virtual meeting with structured agenda"
      },
      {
        channel: "Team Updates",
        audience: stakeholderRegister.filter((s: any) => s.role === "project_stakeholder"),
        frequency: "weekly",
        format: "Email updates and team channels"
      }
    ],
    communicationPrinciples: [
      "Right information to right people at right time",
      "Two-way communication encouraged",
      "Escalation paths clearly defined"
    ]
  };
}

function generateSatisfactionSurvey(stakeholderRegister: any[], program: any) {
  return {
    surveyTemplate: {
      questions: [
        "How satisfied are you with program communication?",
        "How well are your needs being met by the program?", 
        "How would you rate program progress visibility?",
        "What improvements would you suggest?"
      ],
      scale: "1-5 (Very Dissatisfied to Very Satisfied)",
      frequency: "quarterly"
    },
    targetStakeholders: stakeholderRegister.length,
    distributionMethod: "email_survey",
    analysisApproach: "Aggregate scores with trend analysis"
  };
}

function generateStakeholderRecommendations(stakeholderManagement: any, engagementLevel: string) {
  const recommendations = [];

  if (stakeholderManagement.stakeholderRegister.length > 20) {
    recommendations.push("Large stakeholder base - consider stakeholder segmentation strategy");
  }

  if (engagementLevel === "minimal") {
    recommendations.push("Consider increasing engagement level for better program support");
  }

  if (stakeholderManagement.influenceMapping?.highInfluenceHighInterest?.length === 0) {
    recommendations.push("Identify and engage key program champions for better support");
  }

  return recommendations;
}