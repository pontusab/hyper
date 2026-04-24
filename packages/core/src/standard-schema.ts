/**
 * Standard Schema adapter.
 *
 * Hyper does not depend on any specific validation library; we accept
 * anything implementing the `~standard` contract.
 *
 * Spec: https://github.com/standard-schema/standard-schema
 */

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1Props<Input, Output>
}

export interface StandardSchemaV1Props<Input, Output> {
  readonly version: 1
  readonly vendor: string
  readonly validate: (
    value: unknown,
  ) => StandardSchemaV1Result<Output> | Promise<StandardSchemaV1Result<Output>>
  readonly types?: { readonly input: Input; readonly output: Output }
}

export type StandardSchemaV1Result<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly value?: undefined; readonly issues: readonly StandardSchemaV1Issue[] }

export interface StandardSchemaV1Issue {
  readonly message: string
  readonly path?: readonly (string | number | symbol)[] | undefined
}

/**
 * Run a Standard Schema against `value`. Returns the parsed value or
 * throws a `SchemaValidationError` with the issues attached so the
 * error mapper can project to a 400 with why/fix.
 */
export async function parseStandard<I, O>(
  schema: StandardSchemaV1<I, O>,
  value: unknown,
): Promise<O> {
  const result = await schema["~standard"].validate(value)
  if (result.issues && result.issues.length > 0) {
    throw new SchemaValidationError(result.issues)
  }

  return result.value as O
}

export class SchemaValidationError extends Error {
  readonly issues: readonly StandardSchemaV1Issue[]
  constructor(issues: readonly StandardSchemaV1Issue[]) {
    super(
      issues
        .map((i) => `${(i.path ?? []).map(String).join(".") || "(root)"}: ${i.message}`)
        .join("; "),
    )
    this.name = "SchemaValidationError"
    this.issues = issues
  }
}

/** Narrowing guard. */
export function isStandardSchema(x: unknown): x is StandardSchemaV1 {
  return (
    typeof x === "object" &&
    x !== null &&
    "~standard" in x &&
    typeof (x as { "~standard": unknown })["~standard"] === "object"
  )
}
