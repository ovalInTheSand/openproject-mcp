# API Reference - OpenProject MCP Server v2.0.0

> **Complete Tool Reference for Your MCP Server**  
> All 54 available tools with examples and parameters
> 
> **Transport Options:**
> - **Primary**: `/mcp` - MCP protocol over streamable HTTP
> - **Optional**: `/sse` - Server-Sent Events for real-time updates (disabled by default)

## Tool Categories

- [Core Operations](#core-operations) (5 tools)
- [Workflow Support](#workflow-support) (9 tools) 
- [Enterprise Management](#enterprise-management) (23 tools)
- [Portfolio Management](#portfolio-management) (5 tools)
- [Risk Management](#risk-management) (4 tools)
- [Predictive Analytics](#predictive-analytics) (3 tools)
- [Program Management](#program-management) (4 tools)
- [Real-time Events](#real-time-events) (SSE endpoint)

---

## Core Operations

### op.health
**Check OpenProject connectivity and authentication**

```json
{
  "name": "op.health",
  "arguments": {}
}
```

**Response:**
```json
{
  "status": "ok",
  "statusCode": 200,
  "instanceName": "OpenProject",
  "version": "12.5.0",
  "_links": {...}
}
```

### projects.list
**List projects with optional filtering**

```json
{
  "name": "projects.list", 
  "arguments": {
    "filters": {"status": {"operator": "=", "values": ["active"]}},
    "pageSize": 20,
    "offset": 0
  }
}
```

### types.list
**Get work package types for project**

```json
{
  "name": "types.list",
  "arguments": {
    "projectId": 1  // optional, omit for global types
  }
}
```

### wp.list
**List work packages with filtering**

```json
{
  "name": "wp.list",
  "arguments": {
    "projectId": 1,
    "filters": {"assignee": {"operator": "=", "values": ["me"]}},
    "sortBy": [{"field": "updatedAt", "direction": "desc"}],
    "pageSize": 20
  }
}
```

### wp.create
**Create work package (forms-first validation)**

```json
{
  "name": "wp.create",
  "arguments": {
    "projectId": 1,
    "typeId": 1, 
    "subject": "Fix authentication bug",
    "description": "Users can't login with special characters",
    "priorityId": 2,
    "assigneeId": 5,
    "dryRun": false
  }
}
```

---

## Workflow Support

### wp.update
**Update work package (requires lockVersion)**

```json
{
  "name": "wp.update",
  "arguments": {
    "id": 123,
    "lockVersion": 5,
    "statusId": 7,
    "subject": "Updated: Fix authentication bug",
    "percentDone": 50
  }
}
```

### wp.attach
**Attach file to work package**

```json
{
  "name": "wp.attach",
  "arguments": {
    "workPackageId": 123,
    "fileName": "screenshot.png",
    "description": "Bug reproduction screenshot", 
    "dataBase64": "iVBORw0KGgoAAAANSUhEUgAA..."
  }
}
```

### queries.list
**List saved queries**

```json
{
  "name": "queries.list",
  "arguments": {
    "projectId": 1  // optional, omit for global queries
  }
}
```

### queries.run
**Execute saved query**

```json
{
  "name": "queries.run",
  "arguments": {
    "id": 15
  }
}
```

### statuses.list
**List work package statuses**

```json
{
  "name": "statuses.list",
  "arguments": {
    "projectId": 1  // optional, omit for global statuses
  }
}
```

### priorities.list
**List work package priorities**

```json
{
  "name": "priorities.list", 
  "arguments": {
    "projectId": 1  // optional, omit for global priorities
  }
}
```

### versions.list
**List project versions/milestones**

```json
{
  "name": "versions.list",
  "arguments": {
    "projectId": 1,
    "pageSize": 20
  }
}
```

### users.search
**Search users by name/login**

```json
{
  "name": "users.search",
  "arguments": {
    "q": "john",
    "status": "active",
    "pageSize": 10
  }
}
```

### users.me
**Get current user information**

```json
{
  "name": "users.me",
  "arguments": {}
}
```

---

## Enterprise Management

### projects.create
**Create project with full enterprise schema**

```json
{
  "name": "projects.create",
  "arguments": {
    "name": "Customer Portal Redesign",
    "identifier": "portal-redesign-2025",
    "description": "Complete overhaul of customer-facing portal",
    "public": false,
    "parentId": 5,
    "customFields": {
      "portfolio": "Customer Experience",
      "budget": 150000,
      "riskLevel": "medium"
    }
  }
}
```

### projects.update
**Update project with enterprise metadata**

```json
{
  "name": "projects.update",
  "arguments": {
    "id": 1,
    "lockVersion": 3,
    "status": "active",
    "customFields": {
      "actualBudget": 125000,
      "riskLevel": "low"
    }
  }
}
```

### projects.archive
**Archive project with reason tracking**

```json
{
  "name": "projects.archive",
  "arguments": {
    "id": 1,
    "reason": "Project completed successfully on schedule"
  }
}
```

### wp.createEnterprise
**Create work package with advanced scheduling**

```json
{
  "name": "wp.createEnterprise",
  "arguments": {
    "projectId": 1,
    "typeId": 1,
    "subject": "Implement OAuth2 integration", 
    "description": "Add OAuth2 authentication to improve security",
    "startDate": "2025-02-01",
    "dueDate": "2025-02-15",
    "estimatedTime": "40h",
    "dependencies": [45, 46],
    "customFields": {
      "complexity": "high",
      "businessValue": "critical"
    }
  }
}
```

### wp.updateEnterprise
**Update with complete scheduling control**

```json
{
  "name": "wp.updateEnterprise",
  "arguments": {
    "id": 123,
    "lockVersion": 8,
    "percentDone": 75,
    "remainingTime": "10h",
    "actualStartDate": "2025-02-01",
    "schedulingMode": "automatic",
    "customFields": {
      "actualComplexity": "medium"
    }
  }
}
```

### time.logEnterprise
**Log time with cost accounting**

```json
{
  "name": "time.logEnterprise",
  "arguments": {
    "workPackageId": 123,
    "hours": 4.5,
    "comment": "Implemented authentication middleware",
    "spentOn": "2025-01-28",
    "activityId": 1,
    "billableRate": 125.00,
    "costCenter": "DEV-AUTH"
  }
}
```

### time.generateTimesheet
**Generate comprehensive timesheets**

```json
{
  "name": "time.generateTimesheet",
  "arguments": {
    "userId": 5,
    "startDate": "2025-01-01", 
    "endDate": "2025-01-31",
    "includeProjects": [1, 2, 3],
    "format": "summary"
  }
}
```

### milestones.createEnterprise
**Create milestone with phase gates**

```json
{
  "name": "milestones.createEnterprise",
  "arguments": {
    "projectId": 1,
    "name": "Authentication System Complete",
    "date": "2025-03-01",
    "description": "All authentication features implemented and tested",
    "phaseGate": true,
    "approvers": [3, 7],
    "deliverables": ["Security audit", "Documentation", "Test results"]
  }
}
```

### dependencies.create
**Create dependency with lead/lag times**

```json
{
  "name": "dependencies.create",
  "arguments": {
    "fromId": 45,
    "toId": 46,
    "type": "follows",
    "lag": 2,
    "lagUnit": "days",
    "description": "Testing can start 2 days after development completes"
  }
}
```

### dependencies.analyze
**Analyze critical path**

```json
{
  "name": "dependencies.analyze",
  "arguments": {
    "projectId": 1,
    "includeFloat": true,
    "showCriticalPath": true
  }
}
```

### reports.earnedValue
**Generate EVM reports (PMBOK standard)**

```json
{
  "name": "reports.earnedValue",
  "arguments": {
    "projectId": 1,
    "reportDate": "2025-01-31",
    "baselineDate": "2025-01-01",
    "includeForecasting": true
  }
}
```

### reports.criticalPath
**Generate critical path analysis**

```json
{
  "name": "reports.criticalPath",
  "arguments": {
    "projectId": 1,
    "showFloat": true,
    "includeResources": true
  }
}
```

### reports.projectDashboard
**Generate comprehensive KPI dashboard**

```json
{
  "name": "reports.projectDashboard",
  "arguments": {
    "projectId": 1,
    "metrics": ["schedule", "budget", "quality", "risk"],
    "period": "current-month"
  }
}
```

---

## Portfolio Management

### portfolio.create
**Create enterprise portfolio**

```json
{
  "name": "portfolio.create",
  "arguments": {
    "name": "Digital Transformation 2025",
    "identifier": "digital-transform-2025", 
    "description": "Enterprise-wide digital transformation initiative",
    "strategicObjectives": ["Improve customer experience", "Reduce operational costs"],
    "budget": 2500000,
    "governance": {
      "steeringCommittee": [1, 2, 3],
      "reportingFrequency": "monthly"
    }
  }
}
```

### portfolio.listProjects
**List projects with hierarchy**

```json
{
  "name": "portfolio.listProjects",
  "arguments": {
    "portfolioId": 1,
    "includeHierarchy": true,
    "showCustomFields": true
  }
}
```

### portfolio.balanceResources
**Balance resources across portfolio**

```json
{
  "name": "portfolio.balanceResources",
  "arguments": {
    "portfolioId": 1,
    "timeframe": "next-quarter",
    "considerSkills": true,
    "maxUtilization": 85
  }
}
```

### portfolio.generateHealthDashboard
**Generate portfolio health dashboard**

```json
{
  "name": "portfolio.generateHealthDashboard",
  "arguments": {
    "portfolioId": 1,
    "includeProjects": true,
    "showTrends": true,
    "period": "last-6-months"
  }
}
```

### portfolio.trackBenefits
**Track benefits realization**

```json
{
  "name": "portfolio.trackBenefits",
  "arguments": {
    "portfolioId": 1,
    "measurementDate": "2025-01-31",
    "includeProjections": true
  }
}
```

---

## Risk Management

### risk.createRegister
**Create comprehensive risk register**

```json
{
  "name": "risk.createRegister",
  "arguments": {
    "projectId": 1,
    "template": "standard",
    "includeMitigation": true,
    "assignOwners": true
  }
}
```

### risk.performQuantitativeAnalysis
**Perform quantitative risk analysis**

```json
{
  "name": "risk.performQuantitativeAnalysis",
  "arguments": {
    "projectId": 1,
    "method": "monte-carlo",
    "iterations": 1000,
    "confidenceLevel": 95
  }
}
```

### risk.trackMitigation
**Track risk mitigation progress**

```json
{
  "name": "risk.trackMitigation",
  "arguments": {
    "projectId": 1,
    "riskId": 15,
    "status": "in-progress",
    "effectiveness": "high"
  }
}
```

### risk.generateBurndown
**Generate risk burndown charts**

```json
{
  "name": "risk.generateBurndown",
  "arguments": {
    "projectId": 1,
    "period": "project-lifecycle",
    "showTrends": true
  }
}
```

---

## Predictive Analytics

### analytics.predictSuccess
**Predict project success using ML**

```json
{
  "name": "analytics.predictSuccess",
  "arguments": {
    "projectId": 1,
    "model": "ensemble",
    "includeFactors": true
  }
}
```

### analytics.recommendActions
**Recommend actions using AI**

```json
{
  "name": "analytics.recommendActions",
  "arguments": {
    "projectId": 1,
    "currentHealth": "amber",
    "priority": "schedule",
    "maxRecommendations": 5
  }
}
```

### analytics.benchmarkPerformance
**Benchmark against industry standards**

```json
{
  "name": "analytics.benchmarkPerformance",
  "arguments": {
    "projectId": 1,
    "industry": "technology",
    "projectType": "software-development",
    "metrics": ["schedule", "budget", "quality"]
  }
}
```

---

## Program Management

### program.create
**Create enterprise program**

```json
{
  "name": "program.create",
  "arguments": {
    "name": "Cloud Migration Program",
    "identifier": "cloud-migration-2025",
    "projects": [1, 2, 3, 4],
    "governance": {
      "programBoard": [1, 2, 3],
      "reportingStructure": "matrix"
    }
  }
}
```

### program.coordinateDeliveries
**Coordinate deliveries across program**

```json
{
  "name": "program.coordinateDeliveries",
  "arguments": {
    "programId": 1,
    "timeframe": "next-quarter",
    "resolveDependencies": true
  }
}
```

### program.trackBenefits
**Track program-level benefits**

```json
{
  "name": "program.trackBenefits",
  "arguments": {
    "programId": 1,
    "measurementPeriod": "quarterly",
    "includeROI": true
  }
}
```

### program.manageStakeholders
**Manage program stakeholders**

```json
{
  "name": "program.manageStakeholders",
  "arguments": {
    "programId": 1,
    "engagementLevel": "high",
    "communicationPlan": "monthly-updates"
  }
}
```

---

## Common Parameters

### Pagination
```json
{
  "pageSize": 20,      // Max 100, default 20
  "offset": 0          // Starting position, default 0
}
```

### Filtering
```json
{
  "filters": {
    "status": {"operator": "=", "values": ["active"]},
    "assignee": {"operator": "=", "values": ["me"]},
    "createdAt": {"operator": ">=", "values": ["2025-01-01"]}
  }
}
```

### Sorting
```json
{
  "sortBy": [
    {"field": "updatedAt", "direction": "desc"},
    {"field": "priority", "direction": "asc"}
  ]
}
```

### Dry Run
Most create/update operations support:
```json
{
  "dryRun": true  // Validate without making changes
}
```

---

## Real-time Events

### SSE Endpoint Configuration

**Enable Server-Sent Events:**
```bash
# Set in environment variables
SSE_ENABLED=true
```

**Endpoint:** `GET /sse`

### SSE Connection

**Basic Connection:**
```javascript
const eventSource = new EventSource('/sse');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
};
```

**Filtered Connection:**
```javascript
// Filter by project
const eventSource = new EventSource('/sse?projectId=1');

// Filter by work package  
const eventSource = new EventSource('/sse?workPackageId=123');

// Filter by event type
const eventSource = new EventSource('/sse?eventType=work_package_update');

// Combined filters
const eventSource = new EventSource('/sse?projectId=1&eventType=project_update');
```

### SSE Event Types

**Standard Events:**
- `project_update` - Project changes and status updates
- `work_package_update` - Work package modifications
- `time_entry_update` - Time logging changes
- `tool_execution` - MCP tool execution notifications
- `heartbeat` - Connection keepalive (every 30 seconds)
- `error` - Error notifications

**Event Structure:**
```json
{
  "id": "1640995200_001",
  "type": "work_package_update",
  "data": {
    "workPackageId": 123,
    "projectId": 1,
    "changes": {
      "status": "In Progress",
      "assignee": "john.doe@example.com"
    },
    "timestamp": "2025-01-31T10:00:00Z"
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

### SSE Client Examples

**React Hook:**
```javascript
import { useEffect, useState } from 'react';

function useOpenProjectEvents(projectId, eventTypes = []) {
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    eventTypes.forEach(type => params.append('eventType', type));
    
    const eventSource = new EventSource(`/sse?${params}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setEvents(prev => [...prev, data]);
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
    };
    
    return () => eventSource.close();
  }, [projectId, eventTypes]);
  
  return events;
}
```

**Node.js Client:**
```javascript
import { EventSource } from 'eventsource';

const eventSource = new EventSource('http://localhost:8788/sse?projectId=1');

eventSource.addEventListener('project_update', (event) => {
  const data = JSON.parse(event.data);
  console.log('Project updated:', data);
});

eventSource.addEventListener('work_package_update', (event) => {
  const data = JSON.parse(event.data);
  console.log('Work package updated:', data);
});
```

### SSE Error Handling

**Connection Status Check:**
```javascript
const eventSource = new EventSource('/sse');

eventSource.onopen = () => {
  console.log('SSE connection opened');
};

eventSource.onerror = (event) => {
  switch(eventSource.readyState) {
    case EventSource.CONNECTING:
      console.log('Reconnecting...');
      break;
    case EventSource.CLOSED:
      console.log('Connection closed');
      break;
  }
};
```

**Disabled Endpoint Response:**
```json
{
  "error": "SSE endpoint is disabled",
  "message": "Set SSE_ENABLED=true to enable Server-Sent Events"
}
```

---

**Last Updated:** August 2025  
**Version:** 2.0.0  
**Total Tools:** 54  
**SSE Support:** Optional (disabled by default)