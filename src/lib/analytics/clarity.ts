/** Session recording is disabled until consent and SPA lifecycle isolation are reviewed.
 * Preserve the event-call API so public UI callers do not need a tracking dependency. */
export function clarityEvent(_name: string): void {
  // Intentionally no third-party tracking or lazy recorder injection.
}
