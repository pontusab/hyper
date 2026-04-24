/**
 * TanStack Query helpers — tiny wrappers that build queryKey/queryFn or
 * mutationFn pairs from a generated client function.
 *
 * These do not depend on @tanstack/react-query at compile time; the user
 * provides the types via the helper's generics.
 */

type Leaf<T = unknown> = (input?: {
  params?: Record<string, string>
  query?: Record<string, unknown>
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}) => Promise<T>

export function queryOptions<T>(
  leaf: Leaf<T>,
  input?: Parameters<Leaf<T>>[0],
): { queryKey: readonly unknown[]; queryFn: () => Promise<T> } {
  return {
    queryKey: [leaf.name || "hyper", input],
    queryFn: () => leaf(input),
  }
}

export function mutationOptions<T, I extends Parameters<Leaf<T>>[0] | undefined>(
  leaf: Leaf<T>,
): { mutationFn: (input: I) => Promise<T> } {
  return {
    mutationFn: (input: I) => leaf(input),
  }
}
