/**
 * Result pattern — type-safe representation of either a successful value or
 * a typed failure. Avoids throwing exceptions across layer boundaries and
 * makes error handling explicit in the type system.
 */
export type ResultOk<T> = { readonly ok: true; readonly value: T };
export type ResultFail<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Error> = ResultOk<T> | ResultFail<E>;

function isOk<T, E>(r: Result<T, E>): r is ResultOk<T> {
  return r.ok === true;
}

function isFail<T, E>(r: Result<T, E>): r is ResultFail<E> {
  return r.ok === false;
}

function ok<T>(value: T): ResultOk<T> {
  return { ok: true, value };
}

function fail<E>(error: E): ResultFail<E> {
  return { ok: false, error };
}

function map<T, U, E>(r: Result<T, E>, fn: (v: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : r;
}

async function fromPromise<T>(
  p: Promise<T>,
  mapError: (e: unknown) => Error = (e) =>
    e instanceof Error ? e : new Error(String(e)),
): Promise<Result<T, Error>> {
  try {
    const value = await p;
    return ok(value);
  } catch (e) {
    return fail(mapError(e));
  }
}

/**
 * Companion namespace exposing the helpers. Kept as a `const` so callers
 * write `Result.ok(...)` / `Result.isFail(...)` while the underlying
 * functions retain explicit `r is …` type predicates that the compiler
 * narrows reliably.
 */
export const Result = {
  ok,
  fail,
  isOk,
  isFail,
  map,
  fromPromise,
} as const;
