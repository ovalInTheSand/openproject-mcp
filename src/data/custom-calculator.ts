// src/data/custom-calculator.ts
import type { 
  NativeProjectMetrics, 
  NativeWorkPackageData,
  NativeTimeEntry,
  PMOVariables,
  EVMCalculation,
  CriticalPathAnalysis,
  CriticalPathNode,
  ResourceUtilization 
} from "../types/hybrid-data";

/**
 * Custom Calculation Engine for Enterprise PMO Features
 * 
 * Implements sophisticated project management calculations that are:
 * 1. Not available in OpenProject Community edition
 * 2. Behind Enterprise paywall features
 * 3. Custom PMO analytics not provided by OpenProject
 * 
 * Uses OpenProject's native data as input for maximum accuracy.
 */
export class CustomPMCalculator {
  
  /**
   * Calculate Earned Value Management (EVM) metrics using PMBOK standards
   * This is typically an Enterprise feature - we implement full EVM analysis
   */
  calculateEVM(
    nativeData: NativeProjectMetrics, 
    variables: PMOVariables,
    asOfDate?: Date
  ): EVMCalculation {
    const reportDate = asOfDate || new Date();
    const reportDateString = reportDate.toISOString().split('T')[0];
    
    // Calculate Budget at Completion (BAC) from native estimated hours
    const budgetAtCompletion = nativeData.totalEstimatedHours * variables.standardLaborRate;
    
    // Calculate Planned Value (PV) based on schedule
    const plannedValue = this.calculatePlannedValue(nativeData, budgetAtCompletion, reportDate);
    
    // Calculate Earned Value (EV) from OpenProject's native percentageDone
  let earnedValue = this.calculateEarnedValue(nativeData, budgetAtCompletion);
  if (earnedValue == null || !Number.isFinite(earnedValue)) earnedValue = 0;
    
    // Calculate Actual Cost (AC) from time entries and rates
    const actualCost = this.calculateActualCost(nativeData.timeEntries, variables);
    
    // Calculate performance indices
    const costPerformanceIndex = actualCost > 0 ? earnedValue / actualCost : 1;
    const schedulePerformanceIndex = plannedValue > 0 ? earnedValue / plannedValue : 1;
    
    // Calculate variances
    const costVariance = earnedValue - actualCost;
    const scheduleVariance = earnedValue - plannedValue;
    
    // Calculate forecasts using selected method
    const forecasts = this.calculateEVMForecasts(
      budgetAtCompletion,
      earnedValue,
      actualCost,
      costPerformanceIndex,
      schedulePerformanceIndex,
      variables.forecastMethod
    );
    
    // Determine status based on thresholds
    const costStatus = this.determineCostStatus(costPerformanceIndex, variables.costPerformanceThreshold);
    const scheduleStatus = this.determineScheduleStatus(schedulePerformanceIndex, variables.schedulePerformanceThreshold);
    const overallHealth = this.determineOverallHealth(costPerformanceIndex, schedulePerformanceIndex, variables);
    
    return {
      budgetAtCompletion: Math.round(budgetAtCompletion * 100) / 100,
      plannedValue: Math.round(plannedValue * 100) / 100,
      earnedValue: Math.round(earnedValue * 100) / 100,
      actualCost: Math.round(actualCost * 100) / 100,
      costPerformanceIndex: Math.round(costPerformanceIndex * 1000) / 1000,
      schedulePerformanceIndex: Math.round(schedulePerformanceIndex * 1000) / 1000,
      costVariance: Math.round(costVariance * 100) / 100,
      scheduleVariance: Math.round(scheduleVariance * 100) / 100,
      estimateAtCompletion: Math.round(forecasts.estimateAtCompletion * 100) / 100,
      estimateToComplete: Math.round(forecasts.estimateToComplete * 100) / 100,
      varianceAtCompletion: Math.round(forecasts.varianceAtCompletion * 100) / 100,
      toCompletePerformanceIndex: Math.round(forecasts.toCompletePerformanceIndex * 1000) / 1000,
      costStatus,
      scheduleStatus,
      overallHealth,
      calculationDate: reportDate.toISOString().split('T')[0] || new Date().toISOString(),
      method: variables.evmMethod,
      confidence: this.calculateConfidence(nativeData, variables),
      forecastVariants: forecasts.variants,
      forecastMethodApplied: forecasts.methodApplied
    };
  }
  
  /**
   * Calculate Planned Value based on project schedule and current date
   */
  private calculatePlannedValue(
    nativeData: NativeProjectMetrics, 
    budgetAtCompletion: number, 
    asOfDate: Date
  ): number {
    // Find project start and end dates from work packages
    const dates = nativeData.workPackages
      .filter(wp => wp.startDate && wp.dueDate)
      .map(wp => ({ start: new Date(wp.startDate!), end: new Date(wp.dueDate!) }));
    
    if (dates.length === 0) {
      // No schedule data available, assume linear progress
      const projectAge = Math.max(1, Math.ceil((asOfDate.getTime() - new Date().getTime() + 30 * 24 * 60 * 60 * 1000) / (1000 * 60 * 60 * 24)));
      const assumedDuration = Math.max(90, projectAge); // Assume at least 90 days
      return budgetAtCompletion * Math.min(1, projectAge / assumedDuration);
    }
    
    const projectStart = new Date(Math.min(...dates.map(d => d.start.getTime())));
    const projectEnd = new Date(Math.max(...dates.map(d => d.end.getTime())));
    
    const totalDuration = projectEnd.getTime() - projectStart.getTime();
    const elapsedDuration = Math.max(0, asOfDate.getTime() - projectStart.getTime());
    
    if (totalDuration <= 0) return 0;
    
    // Calculate planned progress based on time elapsed
    const timeProgress = Math.min(1, elapsedDuration / totalDuration);
    
    return budgetAtCompletion * timeProgress;
  }
  
  /**
   * Calculate Earned Value from OpenProject's native completion percentages
   */
  private calculateEarnedValue(nativeData: NativeProjectMetrics, budgetAtCompletion: number): number {
    // Use weighted average based on work package budget allocation
    let totalEarnedValue = 0;
    
    nativeData.workPackages.forEach(wp => {
      const wpEstimatedHours = this.parseISO8601Duration(wp.estimatedTime) || 1;
      const wpBudget = (wpEstimatedHours / nativeData.totalEstimatedHours) * budgetAtCompletion;
      const wpEarnedValue = wpBudget * (wp.percentageDone / 100);
      totalEarnedValue += wpEarnedValue;
    });
    
  if (totalEarnedValue == null || !Number.isFinite(totalEarnedValue)) return 0;
  return totalEarnedValue;
  }
  
  /**
   * Calculate Actual Cost from time entries and labor rates
   */
  private calculateActualCost(timeEntries: NativeTimeEntry[], variables: PMOVariables): number {
    return timeEntries.reduce((total, entry) => {
      // Use standard rate for all entries unless we have user-specific rates
      // In the future, this could be enhanced with user-specific custom field rates
      const rate = variables.standardLaborRate;
      return total + (entry.hours * rate);
    }, 0);
  }
  
  /**
   * Calculate EVM forecasts based on selected method
   */
  private calculateEVMForecasts(
    budgetAtCompletion: number,
    earnedValue: number,
    actualCost: number,
    costPerformanceIndex: number,
    schedulePerformanceIndex: number,
    forecastMethod: PMOVariables['forecastMethod']
  ) {
    const remainingWork = budgetAtCompletion - earnedValue;
    const cpi = Math.max(0.01, costPerformanceIndex);
    const spi = Math.max(0.01, schedulePerformanceIndex);
    const combined = Math.max(0.01, cpi * spi);

    // PMI common variants
    const eacCpiBased = budgetAtCompletion / cpi;                         // EAC = BAC / CPI
    const eacBudgetRate = actualCost + remainingWork;                     // EAC = AC + (BAC - EV)
    const eacSpiCpi = actualCost + (remainingWork / combined);            // EAC = AC + (BAC - EV)/(CPI*SPI)
    const eacAcPlusRemainingOverCpi = actualCost + (remainingWork / cpi); // EAC = AC + (BAC - EV)/CPI

    let methodApplied = 'CPI';
    let selectedEAC = eacCpiBased;
    switch (forecastMethod) {
      case 'CPI':
        methodApplied = 'CPI';
        selectedEAC = eacCpiBased;
        break;
      case 'SPI_CPI':
        methodApplied = 'SPI_CPI';
        selectedEAC = eacSpiCpi;
        break;
      case 'custom_regression':
        // Use performance adjusted by risk (custom) but keep variants for transparency
        const performanceIndex = (cpi + spi) / 2;
        const riskAdjustment = this.getRiskAdjustment(performanceIndex);
        selectedEAC = budgetAtCompletion / Math.max(0.1, performanceIndex * riskAdjustment);
        methodApplied = 'custom_regression';
        break;
      default:
        selectedEAC = eacCpiBased;
    }

    const estimateAtCompletion = selectedEAC;
    const estimateToComplete = Math.max(0, estimateAtCompletion - actualCost);
    const varianceAtCompletion = budgetAtCompletion - estimateAtCompletion;
    const remainingBudget = remainingWork;
    const toCompletePerformanceIndex = remainingBudget > 0 ? estimateToComplete / remainingBudget : 1;

    return {
      estimateAtCompletion,
      estimateToComplete,
      varianceAtCompletion,
      toCompletePerformanceIndex,
      variants: {
        cpiBased: eacCpiBased,
        budgetRate: eacBudgetRate,
        spiCpiCombined: eacSpiCpi,
        acPlusRemainingOverCpi: eacAcPlusRemainingOverCpi
      },
      methodApplied
    };
  }
  
  /**
   * Critical Path Method (CPM) analysis - Enterprise feature implementation
   */
  calculateCriticalPath(
    nativeData: NativeProjectMetrics,
    dependencies: { fromId: string; toId: string; type: string; lag?: number }[] = []
  ): CriticalPathAnalysis {
    const nodes = new Map<string, CriticalPathNode>();
    
    // Build nodes from work packages
    nativeData.workPackages.forEach(wp => {
      const duration = this.calculateWorkPackageDuration(wp);
      nodes.set(String(wp.id), {
        id: wp.id,
        name: wp.subject,
        duration,
        earliestStart: 0,
        earliestFinish: duration,
        latestStart: 0,
        latestFinish: duration,
        totalFloat: 0,
        freeFloat: 0,
        isCritical: false,
        percentComplete: wp.percentageDone,
        predecessors: [],
        successors: []
      });
    });
    
    // Add dependency relationships
    dependencies.forEach(dep => {
      const fromNode = nodes.get(dep.fromId);
      const toNode = nodes.get(dep.toId);
      if (fromNode && toNode) {
        fromNode.successors.push(dep.toId);
        toNode.predecessors.push(dep.fromId);
      }
    });
    
    // Forward pass - calculate earliest times
    this.calculateEarliestTimes(nodes);
    
    // Backward pass - calculate latest times
    const projectFinish = Math.max(...Array.from(nodes.values()).map(node => node.earliestFinish));
    this.calculateLatestTimes(nodes, projectFinish);
    
    // Calculate float and identify critical path
    const criticalPath: string[] = [];
    nodes.forEach((node, id) => {
      node.totalFloat = node.latestStart - node.earliestStart;
      node.isCritical = node.totalFloat === 0;
      if (node.isCritical) {
        criticalPath.push(id);
      }
    });
    
    // Calculate schedule risk based on critical path and progress
    const criticalPathLength = criticalPath.length;
    const averageCriticalProgress = criticalPath.reduce((sum, id) => {
      return sum + (nodes.get(id)?.percentComplete || 0);
    }, 0) / Math.max(1, criticalPath.length);
    
    const scheduleRisk = this.assessScheduleRisk(projectFinish, averageCriticalProgress, nodes);
    
    return {
      nodes,
      criticalPath,
      projectDuration: projectFinish,
      criticalPathLength,
      totalFloat: Math.min(...Array.from(nodes.values()).map(node => node.totalFloat)),
      scheduleRisk,
      recommendations: this.generateCPMRecommendations(nodes, criticalPath),
      analysisDate: new Date().toISOString().split('T')[0] || new Date().toISOString()
    };
  }
  
  /**
   * Calculate resource utilization across projects
   */
  calculateResourceUtilization(
    projectsData: NativeProjectMetrics[],
    variables: PMOVariables,
    startDate: Date,
    endDate: Date
  ): ResourceUtilization[] {
    const userUtilization = new Map<string, ResourceUtilization>();
    
    projectsData.forEach(projectData => {
      projectData.timeEntries.forEach(entry => {
        const userId = String(entry.user.id);
        const userName = entry.user.name;
        
        if (!userUtilization.has(userId)) {
          userUtilization.set(userId, {
            userId,
            userName,
            totalAllocatedHours: 0,
            totalWorkedHours: 0,
            utilizationRate: 0,
            overallocation: false,
            availableCapacity: 0,
            projects: []
          });
        }
        
        const util = userUtilization.get(userId)!;
        util.totalWorkedHours += entry.hours;
        
        // Find or create project entry
        let projectEntry = util.projects.find(p => p.projectId === projectData.id);
        if (!projectEntry) {
          projectEntry = {
            projectId: projectData.id,
            projectName: projectData.name,
            allocatedHours: 0,
            workedHours: 0,
            utilizationRate: 0
          };
          util.projects.push(projectEntry);
        }
        
        projectEntry.workedHours += entry.hours;
      });
    });
    
    // Calculate utilization rates and capacity
    const workingDays = this.calculateWorkingDays(startDate, endDate, variables);
    const maxCapacityHours = workingDays * variables.workingHoursPerDay;
    
    userUtilization.forEach((util, userId) => {
      util.totalAllocatedHours = maxCapacityHours; // Assume full allocation for now
      util.utilizationRate = util.totalWorkedHours / maxCapacityHours;
      util.overallocation = util.utilizationRate > variables.maxAllocation;
      util.availableCapacity = Math.max(0, maxCapacityHours - util.totalWorkedHours);
      
      // Calculate per-project utilization rates
      util.projects.forEach(project => {
        project.utilizationRate = project.workedHours / maxCapacityHours;
        project.allocatedHours = maxCapacityHours * (project.workedHours / util.totalWorkedHours);
      });
    });
    
    return Array.from(userUtilization.values())
      .sort((a, b) => b.utilizationRate - a.utilizationRate);
  }
  
  // Helper methods
  
  private parseISO8601Duration(duration?: string): number {
    if (!duration) return 0;
    const match = duration.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)D)?$/);
    if (!match) return 0;
    const hours = parseFloat(match[1] || '0');
    const days = parseFloat(match[2] || '0');
    return hours + (days * 8);
  }
  
  private calculateWorkPackageDuration(wp: NativeWorkPackageData): number {
    if (wp.startDate && wp.dueDate) {
      const start = new Date(wp.startDate);
      const end = new Date(wp.dueDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(1, diffDays);
    }
    
    // Use estimated time if available
    const estimatedHours = this.parseISO8601Duration(wp.estimatedTime);
    if (estimatedHours > 0) {
      return Math.ceil(estimatedHours / 8); // Convert hours to days
    }
    
    return 1; // Default to 1 day
  }
  
  private calculateEarliestTimes(nodes: Map<string, CriticalPathNode>): void {
    const visited = new Set<string>();
    
    const calculateEarly = (nodeId: string): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = nodes.get(nodeId)!;
      let maxPredecessorFinish = 0;
      
      node.predecessors.forEach(predId => {
        calculateEarly(predId);
        const pred = nodes.get(predId)!;
        maxPredecessorFinish = Math.max(maxPredecessorFinish, pred.earliestFinish);
      });
      
      node.earliestStart = maxPredecessorFinish;
      node.earliestFinish = node.earliestStart + node.duration;
    };
    
    nodes.forEach((_, nodeId) => calculateEarly(nodeId));
  }
  
  private calculateLatestTimes(nodes: Map<string, CriticalPathNode>, projectFinish: number): void {
    const visited = new Set<string>();
    
    const calculateLate = (nodeId: string): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = nodes.get(nodeId)!;
      
      if (node.successors.length === 0) {
        // End node
        node.latestFinish = projectFinish;
      } else {
        let minSuccessorStart = Infinity;
        node.successors.forEach(succId => {
          calculateLate(succId);
          const succ = nodes.get(succId)!;
          minSuccessorStart = Math.min(minSuccessorStart, succ.latestStart);
        });
        node.latestFinish = minSuccessorStart;
      }
      
      node.latestStart = node.latestFinish - node.duration;
    };
    
    nodes.forEach((_, nodeId) => calculateLate(nodeId));
  }
  
  private determineOverallHealth(
    cpi: number,
    spi: number,
    variables: PMOVariables
  ): 'Green' | 'Yellow' | 'Red' {
    const threshold = variables.costPerformanceThreshold;
    const scheduleThreshold = variables.schedulePerformanceThreshold;
    
    if (cpi >= threshold && spi >= scheduleThreshold) return 'Green';
    if (cpi >= threshold * 0.85 && spi >= scheduleThreshold * 0.85) return 'Yellow';
    return 'Red';
  }
  
  private determineCostStatus(cpi: number, threshold: number): EVMCalculation['costStatus'] {
    // Normalize threshold around 1.0 PMI baseline
    if (cpi >= 1.0) return 'Under Budget';
    if (cpi >= threshold) return 'Over Budget';
    return 'Seriously Over Budget';
  }
  
  private determineScheduleStatus(spi: number, threshold: number): EVMCalculation['scheduleStatus'] {
    if (spi >= 1.05) return 'Ahead';
    if (spi >= threshold) return 'On Track';
    if (spi >= threshold * 0.9) return 'Behind';
    return 'Seriously Behind';
  }
  
  private calculateConfidence(nativeData: NativeProjectMetrics, variables: PMOVariables): number {
    // Calculate confidence based on data quality and completeness
    let confidence = 0.5; // Base confidence
    
    // Increase confidence for more data points
    if (nativeData.workPackages.length > 0) confidence += 0.1;
    if (nativeData.timeEntries.length > 10) confidence += 0.1;
    if (nativeData.totalEstimatedHours > 0) confidence += 0.1;
    
    // Increase confidence for project maturity
    if (nativeData.overallPercentComplete > 25) confidence += 0.1;
    if (nativeData.overallPercentComplete > 50) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }
  
  private getRiskAdjustment(performanceIndex: number): number {
    // Adjust forecasts based on current performance
    if (performanceIndex > 1.1) return 1.05; // Good performance, slight optimism
    if (performanceIndex < 0.8) return 0.9;  // Poor performance, add pessimism
    return 1.0; // Normal performance
  }
  
  private assessScheduleRisk(
    projectDuration: number,
    averageCriticalProgress: number,
    nodes: Map<string, CriticalPathNode>
  ): 'Low' | 'Medium' | 'High' {
    const behindScheduleNodes = Array.from(nodes.values()).filter(
      node => node.isCritical && node.percentComplete < 50
    ).length;
    
    if (behindScheduleNodes === 0 && averageCriticalProgress > 75) return 'Low';
    if (behindScheduleNodes <= 2 && averageCriticalProgress > 50) return 'Medium';
    return 'High';
  }
  
  private generateCPMRecommendations(
    nodes: Map<string, CriticalPathNode>,
    criticalPath: string[]
  ): string[] {
    const recommendations: string[] = [];
    
    const behindCritical = criticalPath.filter(id => {
      const node = nodes.get(id);
      return node && node.percentComplete < 50;
    });
    
    if (behindCritical.length > 0) {
      recommendations.push(`Focus on ${behindCritical.length} critical path tasks that are behind schedule`);
    }
    
    const highFloat = Array.from(nodes.values()).filter(node => node.totalFloat > 10);
    if (highFloat.length > 0) {
      recommendations.push(`Consider reallocating resources from ${highFloat.length} tasks with high float`);
    }
    
    return recommendations;
  }
  
  private calculateWorkingDays(startDate: Date, endDate: Date, variables: PMOVariables): number {
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.floor(totalDays / 7);
    const remainingDays = totalDays % 7;
    
    return (totalWeeks * variables.workingDaysPerWeek) + Math.min(remainingDays, variables.workingDaysPerWeek);
  }
}

// Export singleton instance
export const customCalculator = new CustomPMCalculator();