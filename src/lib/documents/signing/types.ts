export interface SigningRequestVM { id: string; title: string; documentId: string; createdAt: string; expiresAt: string; signedAt: string | null; signerName: string | null; state: "PENDING" | "SIGNED" | "EXPIRED" | "REVOKED" | "OUTDATED"; pdfHash: string }
export interface SigningWorkspace { documents: Array<{ id: string; title: string }>; requests: SigningRequestVM[]; scope: string }
export interface CreatedSigningLink { id: string; title: string; url: string; expiresAt: string }
export interface GuestDocumentVM { title: string; pdfHash: string; expiresAt: string; signedAt: string | null; signerName: string | null; consentVersion: string; consentText: string }
