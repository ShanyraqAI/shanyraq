/** Uniform server-action result so clients never throw on business errors. */
export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  message?: string;
  data?: T;
}

export function ok<T>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}
