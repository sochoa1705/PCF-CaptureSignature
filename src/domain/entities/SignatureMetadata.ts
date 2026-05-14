/**
 * Metadata embedded into the signature object. Mirrors the fields the
 * Wacom Signature SDK persists inside a SigObj so a server-side library
 * can later verify the signer's identity and intent.
 */
export interface SignatureMetadata {
  readonly who: string;
  readonly why: string;
  readonly where?: string;
  readonly capturedAtIso: string;
  readonly application?: string;
  readonly documentHash?: string;
  readonly extraIntegrityFields?: Readonly<Record<string, string>>;
}

export const SignatureMetadata = {
  fromInput(input: {
    who: string;
    why: string;
    where?: string;
    application?: string;
    documentHash?: string;
    extraIntegrityFields?: Record<string, string>;
  }): SignatureMetadata {
    if (!input.who?.trim()) {
      throw new Error('SignatureMetadata.who (signer name) is required');
    }
    if (!input.why?.trim()) {
      throw new Error('SignatureMetadata.why (reason) is required');
    }
    return {
      who: input.who.trim(),
      why: input.why.trim(),
      where: input.where?.trim(),
      capturedAtIso: new Date().toISOString(),
      application: input.application?.trim(),
      documentHash: input.documentHash?.trim(),
      extraIntegrityFields: input.extraIntegrityFields
        ? Object.freeze({ ...input.extraIntegrityFields })
        : undefined,
    };
  },
};
