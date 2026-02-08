/**
 * Mock types for Supabase client and related test utilities.
 *
 * These types provide type safety for test mocks, replacing the use of `any`.
 */

export interface MockSupabaseQueryBuilder {
  select: (columns?: string, options?: { count?: string }) => MockSupabaseQueryBuilder;
  insert: (data: unknown) => MockSupabaseQueryBuilder;
  update: (data: unknown) => MockSupabaseQueryBuilder;
  delete: () => MockSupabaseQueryBuilder;
  eq: (column: string, value: unknown) => MockSupabaseQueryBuilder;
  neq: (column: string, value: unknown) => MockSupabaseQueryBuilder;
  in: (column: string, values: unknown[]) => MockSupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean; desc?: boolean }) => MockSupabaseQueryBuilder;
  limit: (count: number) => MockSupabaseQueryBuilder;
  range: (from: number, to: number) => MockSupabaseQueryBuilder;
  single: () => MockSupabaseQueryBuilder;
  execute: () => Promise<{ data: unknown; error: unknown; count?: number | null }>;
}

export interface MockSupabaseClient {
  from: (table: string) => MockSupabaseQueryBuilder;
  rpc: (functionName: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

export interface MockNextAuthSession {
  user?: {
    email?: string;
    id?: string;
    name?: string;
  };
}
