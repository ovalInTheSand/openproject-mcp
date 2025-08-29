// src/types/enterprise.ts - TypeScript overrides for enterprise features (private use)

// Pragmatic typing for complex enterprise features in your private package
// This allows full functionality while maintaining type safety for core features

declare global {
  interface Array<T> {
    // Fix for enterprise array operations
    push(...items: any[]): number;
  }
}

// Enterprise API response typing
export interface EnterpriseApiResponse<T = any> {
  res: Response;
  json: T & {
    _embedded?: {
      elements?: any[];
      [key: string]: any;
    };
    _links?: {
      [key: string]: { href: string; title?: string };
    };
    total?: number;
    count?: number;
    pageSize?: number;
    offset?: number;
    id?: number;
    subject?: string;
    name?: string;
    [key: string]: any;
  };
}

// Enterprise function parameter types
export type EnterpriseCallback<T = any, R = any> = (item: T, index?: number, array?: T[]) => R;
export type EnterpriseReducer<T = any, R = any> = (acc: R, current: T, index?: number, array?: T[]) => R;
export type EnterpriseMapCallback<T = any, R = any> = (item: T, index?: number, array?: T[]) => R;

// Enterprise object types
export type EnterpriseResourceAnalysis = {
  portfolio: any;
  projects: any[];
  resourceUtilization: Record<string, any>;
  overallocations: any[];
  recommendations: any[];
  constraints: any[];
  [key: string]: any;
};

export type EnterpriseProject = {
  id: number;
  name: string;
  _embedded?: {
    [key: string]: any;
  };
  _links?: {
    [key: string]: { href: string };
  };
  [key: string]: any;
};

export type EnterpriseRiskMatrix = {
  [probability: string]: {
    [impact: string]: any[];
  };
};

export type EnterpriseRisk = {
  id: any;
  subject: any;
  riskScore?: number;
  probability?: number;
  impact?: number;
  status?: any;
  [key: string]: any;
};

// Export default enterprise types for easy import
export const EnterpriseTypes = {
  // Common enterprise array initializers
  emptyArray: [] as any[],
  emptyObject: {} as Record<string, any>,
  emptyRiskMatrix: {
    very_high: {
      very_high: [] as any[],
      high: [] as any[],
      medium: [] as any[],
      low: [] as any[],
      very_low: [] as any[]
    },
    high: {
      very_high: [] as any[],
      high: [] as any[],
      medium: [] as any[],
      low: [] as any[],
      very_low: [] as any[]
    },
    medium: {
      very_high: [] as any[],
      high: [] as any[],
      medium: [] as any[],
      low: [] as any[],
      very_low: [] as any[]
    },
    low: {
      very_high: [] as any[],
      high: [] as any[],
      medium: [] as any[],
      low: [] as any[],
      very_low: [] as any[]
    },
    very_low: {
      very_high: [] as any[],
      high: [] as any[],
      medium: [] as any[],
      low: [] as any[],
      very_low: [] as any[]
    }
  } as EnterpriseRiskMatrix
};

export default EnterpriseTypes;