/** Serializable client metadata, never a database client or an authorization grant. */
export interface MutationContext {
  key: string;
  scope: string;
}
