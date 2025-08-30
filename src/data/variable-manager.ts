// src/data/variable-manager.ts
import { opFetch } from "../util/op.js";
import { PMOVariablesSchema, DEFAULT_PMO_VARIABLES } from "../types/hybrid-data";
import type { PMOVariables } from "../types/hybrid-data";
import type { Ctx } from "../tools";

/**
 * PMO Variable Manager
 * 
 * Manages PMO variables using OpenProject's custom field system.
 * Provides a bridge between PMO configuration needs and OpenProject's
 * extensible custom field architecture.
 * 
 * Variables are stored as:
 * 1. Project custom fields for project-specific variables
 * 2. System-wide defaults for organizational standards
 * 3. User custom fields for user-specific rates/preferences
 */
export class PMOVariableManager {
  
  // Custom field name mapping for PMO variables
  private readonly customFieldMapping = {
    standardLaborRate: 'pmo_standard_labor_rate',
    overtimeMultiplier: 'pmo_overtime_multiplier',
    contingencyPercentage: 'pmo_contingency_percentage',
    managementReservePercentage: 'pmo_management_reserve_percentage',
    costPerformanceThreshold: 'pmo_cost_performance_threshold',
    schedulePerformanceThreshold: 'pmo_schedule_performance_threshold',
    qualityThreshold: 'pmo_quality_threshold',
    defaultUtilizationRate: 'pmo_default_utilization_rate',
    maxAllocation: 'pmo_max_allocation',
    workingHoursPerDay: 'pmo_working_hours_per_day',
    workingDaysPerWeek: 'pmo_working_days_per_week',
    riskTolerance: 'pmo_risk_tolerance',
    riskAppetite: 'pmo_risk_appetite',
    evmMethod: 'pmo_evm_method',
    forecastMethod: 'pmo_forecast_method',
    industryType: 'pmo_industry_type',
    complexityFactor: 'pmo_complexity_factor',
    technologyRiskFactor: 'pmo_technology_risk_factor',
    approvalThreshold: 'pmo_approval_threshold',
    changeControlThreshold: 'pmo_change_control_threshold',
    escalationThreshold: 'pmo_escalation_threshold'
  };
  
  /**
   * Get PMO variables for a specific project
   * Combines project-specific overrides with organizational defaults
   */
  async getProjectVariables(ctx: Ctx, projectId: string | number): Promise<PMOVariables> {
    // Start with default values
    let variables: PMOVariables = { ...DEFAULT_PMO_VARIABLES };
    
    // Get organizational defaults (if configured)
    const orgDefaults = await this.getOrganizationalDefaults(ctx);
    if (orgDefaults) {
      variables = { ...variables, ...orgDefaults } as PMOVariables;
    }
    
    // Get project-specific overrides
    const projectOverrides = await this.getProjectSpecificVariables(ctx, projectId);
    if (projectOverrides) {
      variables = { ...variables, ...projectOverrides } as PMOVariables;
    }
    
    // Validate and return
    return variables;
  }
  
  /**
   * Set PMO variables for a project using custom fields
   */
  async setProjectVariables(
    ctx: Ctx, 
    projectId: string | number, 
    variables: Partial<PMOVariables>
  ): Promise<PMOVariables> {
    const { env } = ctx;
    
    // Validate input
    const currentVariables = await this.getProjectVariables(ctx, projectId);
    const validatedVariables = { ...currentVariables, ...variables } as PMOVariables;
    
    // Convert to custom field format
    const customFieldUpdates: any = {};
    
    Object.entries(variables).forEach(([key, value]) => {
      const customFieldName = this.customFieldMapping[key as keyof PMOVariables];
      if (customFieldName && value !== undefined) {
        customFieldUpdates[`customField_${customFieldName}`] = this.serializeValue(value);
      }
    });
    
    // Update project custom fields via form API
    const { json: form } = await opFetch<any>(env, `/api/v3/projects/${projectId}/form`, {
      method: 'POST',
      body: JSON.stringify(customFieldUpdates)
    });
    
    if (form?.validationErrors && Object.keys(form.validationErrors).length > 0) {
      throw new Error(`Validation errors: ${JSON.stringify(form.validationErrors)}`);
    }
    
    // Commit the changes if form is valid
    if (form?._links?.commit) {
      await opFetch<any>(env, form._links.commit.href, {
        method: form._links.commit.method || 'PATCH',
        body: JSON.stringify(form.payload)
      });
    }
    
    return validatedVariables;
  }
  
  /**
   * Get organizational default variables (stored at system level)
   */
  async getOrganizationalDefaults(ctx: Ctx): Promise<Partial<PMOVariables> | null> {
    // In a real implementation, this could be stored as:
    // 1. Global custom fields
    // 2. Configuration in a special "PMO Settings" project
    // 3. Environment variables
    // 4. Database configuration table
    
    // For now, we'll try to get from environment or use defaults
    const { env } = ctx;
    
    const orgDefaults: Partial<PMOVariables> = {};
    
    // Try to get from environment variables (prefixed with PMO_DEFAULT_)
    if (env.PMO_DEFAULT_STANDARD_LABOR_RATE) {
      orgDefaults.standardLaborRate = parseFloat(env.PMO_DEFAULT_STANDARD_LABOR_RATE);
    }
    
    if (env.PMO_DEFAULT_WORKING_HOURS_PER_DAY) {
      orgDefaults.workingHoursPerDay = parseInt(env.PMO_DEFAULT_WORKING_HOURS_PER_DAY);
    }
    
    if (env.PMO_DEFAULT_UTILIZATION_RATE) {
      orgDefaults.defaultUtilizationRate = parseFloat(env.PMO_DEFAULT_UTILIZATION_RATE);
    }
    
    if (env.PMO_DEFAULT_RISK_TOLERANCE) {
      orgDefaults.riskTolerance = env.PMO_DEFAULT_RISK_TOLERANCE as PMOVariables['riskTolerance'];
    }
    
    if (env.PMO_DEFAULT_INDUSTRY_TYPE) {
      orgDefaults.industryType = env.PMO_DEFAULT_INDUSTRY_TYPE;
    }
    
    return Object.keys(orgDefaults).length > 0 ? orgDefaults : null;
  }
  
  /**
   * Set organizational default variables
   */
  async setOrganizationalDefaults(
    ctx: Ctx, 
    defaults: Partial<PMOVariables>
  ): Promise<void> {
    // In a production system, this would store the defaults in a persistent way
    // For now, we'll just validate the input
    const currentDefaults = await this.getOrganizationalDefaults(ctx) || {};
    const updatedDefaults = { ...DEFAULT_PMO_VARIABLES, ...currentDefaults, ...defaults };
    
    // Ensure all required fields are present and validate
    const completeDefaults = { ...DEFAULT_PMO_VARIABLES, ...updatedDefaults };
    PMOVariablesSchema.parse(completeDefaults);
    
    // In a real implementation, persist these defaults
    console.log('Organizational defaults would be persisted:', defaults);
  }
  
  /**
   * Get project-specific variable overrides from custom fields
   */
  private async getProjectSpecificVariables(
    ctx: Ctx, 
    projectId: string | number
  ): Promise<Partial<PMOVariables> | null> {
    const { env } = ctx;
    
    try {
      // Get project with custom fields
      const { json: project } = await opFetch<any>(env, `/api/v3/projects/${projectId}`);
      
      const variables: Partial<PMOVariables> = {};
      
      // Extract custom field values
      Object.entries(this.customFieldMapping).forEach(([varKey, customFieldName]) => {
        const customFieldKey = `customField${customFieldName}`;
        const value = project[customFieldKey];
        
        if (value !== undefined && value !== null) {
          (variables as any)[varKey] = this.deserializeValue(value, varKey as keyof PMOVariables);
        }
      });
      
      return Object.keys(variables).length > 0 ? variables : null;
    } catch (error) {
      console.warn(`Could not fetch project variables for ${projectId}:`, error);
      return null;
    }
  }
  
  /**
   * Get user-specific variables (rates, preferences, etc.)
   */
  async getUserVariables(ctx: Ctx, userId: string | number): Promise<{
    laborRate?: number;
    utilizationRate?: number;
    workingHoursPerDay?: number;
    overtimeMultiplier?: number;
    skillLevel?: 'junior' | 'intermediate' | 'senior' | 'expert';
    costCenter?: string;
  }> {
    const { env } = ctx;
    
    try {
      const { json: user } = await opFetch<any>(env, `/api/v3/users/${userId}`);
      
      const userVars: any = {};
      
      // Map user custom fields to variables
      if (user.customField_labor_rate) {
        userVars.laborRate = parseFloat(user.customField_labor_rate);
      }
      
      if (user.customField_utilization_rate) {
        userVars.utilizationRate = parseFloat(user.customField_utilization_rate);
      }
      
      if (user.customField_working_hours_per_day) {
        userVars.workingHoursPerDay = parseInt(user.customField_working_hours_per_day);
      }
      
      if (user.customField_skill_level) {
        userVars.skillLevel = user.customField_skill_level;
      }
      
      if (user.customField_cost_center) {
        userVars.costCenter = user.customField_cost_center;
      }
      
      return userVars;
    } catch (error) {
      console.warn(`Could not fetch user variables for ${userId}:`, error);
      return {};
    }
  }
  
  /**
   * Get variables for multiple projects efficiently
   */
  async getMultipleProjectVariables(
    ctx: Ctx, 
    projectIds: (string | number)[]
  ): Promise<Map<string | number, PMOVariables>> {
    const variablesMap = new Map<string | number, PMOVariables>();
    
    // Process in parallel for efficiency
    const promises = projectIds.map(async (projectId) => {
      const variables = await this.getProjectVariables(ctx, projectId);
      variablesMap.set(projectId, variables);
    });
    
    await Promise.all(promises);
    
    return variablesMap;
  }
  
  /**
   * Validate variable changes against organizational policies
   */
  async validateVariableChanges(
    ctx: Ctx,
    projectId: string | number,
    changes: Partial<PMOVariables>
  ): Promise<{
    isValid: boolean;
    violations: Array<{
      field: string;
      value: any;
      violation: string;
      severity: 'error' | 'warning';
    }>;
    warnings: string[];
  }> {
    const violations: Array<{
      field: string;
      value: any;
      violation: string;
      severity: 'error' | 'warning';
    }> = [];
    
    const warnings: string[] = [];
    
    // Get current variables for comparison
    const current = await this.getProjectVariables(ctx, projectId);
    const orgDefaults = await this.getOrganizationalDefaults(ctx);
    
    // Validate against organizational policies
    Object.entries(changes).forEach(([field, value]) => {
      switch (field) {
        case 'standardLaborRate':
          if (typeof value === 'number') {
            if (value < 20) {
              violations.push({
                field,
                value,
                violation: 'Labor rate below minimum threshold ($20/hour)',
                severity: 'error'
              });
            } else if (value > 200) {
              warnings.push(`High labor rate (${value}/hour) - consider approval`);
            }
          }
          break;
          
        case 'costPerformanceThreshold':
          if (typeof value === 'number' && value < 0.8) {
            violations.push({
              field,
              value,
              violation: 'Cost performance threshold too low (minimum 0.8)',
              severity: 'error'
            });
          }
          break;
          
        case 'maxAllocation':
          if (typeof value === 'number' && value > 1.5) {
            violations.push({
              field,
              value,
              violation: 'Maximum allocation exceeds 150% - requires approval',
              severity: 'warning'
            });
          }
          break;
          
        case 'workingHoursPerDay':
          if (typeof value === 'number' && value > 10) {
            violations.push({
              field,
              value,
              violation: 'Working hours per day exceeds 10 hours',
              severity: 'warning'
            });
          }
          break;
      }
    });
    
    // Check for significant deviations from organizational defaults
    if (orgDefaults) {
      Object.entries(changes).forEach(([field, value]) => {
        const orgDefault = (orgDefaults as any)[field];
        if (orgDefault !== undefined && typeof value === 'number' && typeof orgDefault === 'number') {
          const deviation = Math.abs((value - orgDefault) / orgDefault);
          if (deviation > 0.5) { // 50% deviation
            warnings.push(`${field} deviates significantly from organizational default`);
          }
        }
      });
    }
    
    return {
      isValid: violations.filter(v => v.severity === 'error').length === 0,
      violations,
      warnings
    };
  }
  
  /**
   * Export variables for backup or migration
   */
  async exportProjectVariables(
    ctx: Ctx, 
    projectIds: (string | number)[]
  ): Promise<{
    exportDate: string;
    organizationalDefaults: Partial<PMOVariables> | null;
    projects: Array<{
      projectId: string | number;
      projectName: string;
      variables: PMOVariables;
    }>;
  }> {
    const projectVariables = await this.getMultipleProjectVariables(ctx, projectIds);
    const orgDefaults = await this.getOrganizationalDefaults(ctx);
    
    const projects = await Promise.all(
      Array.from(projectVariables.entries()).map(async ([projectId, variables]) => {
        // Get project name
        const { json: project } = await opFetch<any>(ctx.env, `/api/v3/projects/${projectId}`);
        
        return {
          projectId,
          projectName: project.name,
          variables
        };
      })
    );
    
    return {
      exportDate: new Date().toISOString(),
      organizationalDefaults: orgDefaults,
      projects
    };
  }
  
  // Helper methods
  
  private serializeValue(value: any): string {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
  
  private deserializeValue(value: string, key: keyof PMOVariables): any {
    // Handle different data types based on the key
    switch (key) {
      case 'riskTolerance':
      case 'riskAppetite':
      case 'evmMethod':
      case 'forecastMethod':
      case 'industryType':
        return value; // String values
        
      case 'standardLaborRate':
      case 'overtimeMultiplier':
      case 'contingencyPercentage':
      case 'managementReservePercentage':
      case 'costPerformanceThreshold':
      case 'schedulePerformanceThreshold':
      case 'qualityThreshold':
      case 'defaultUtilizationRate':
      case 'maxAllocation':
      case 'complexityFactor':
      case 'technologyRiskFactor':
        return parseFloat(value);
        
      case 'workingHoursPerDay':
      case 'workingDaysPerWeek':
      case 'approvalThreshold':
      case 'changeControlThreshold':
      case 'escalationThreshold':
        return parseInt(value);
        
      default:
        // Try to parse as JSON first, then as string
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
    }
  }
  
  /**
   * Get variable history and audit trail
   */
  async getVariableHistory(
    ctx: Ctx, 
    projectId: string | number,
    field?: keyof PMOVariables
  ): Promise<Array<{
    timestamp: string;
    field: string;
    oldValue: any;
    newValue: any;
    changedBy: string;
    reason?: string;
  }>> {
    // In a real implementation, this would query an audit log
    // For now, return empty array
    return [];
  }
  
  /**
   * Create custom fields for PMO variables if they don't exist
   */
  async ensurePMOCustomFields(ctx: Ctx): Promise<void> {
    // In a real implementation, this would:
    // 1. Check if PMO custom fields exist
    // 2. Create them if they don't exist
    // 3. Set appropriate permissions and validations
    
    console.log('PMO custom fields would be created/validated here');
  }
}

// Export singleton instance
export const variableManager = new PMOVariableManager();