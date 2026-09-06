export interface ConfigContext {
  readonly openemrBaseUrl: string;
  readonly keyVaultUri: string;
  readonly ahdsFhirUrl: string;
  readonly openemrClientIdSecretName: string;
  readonly openemrPrivateKeySecretName: string;
  readonly timerEnabled: boolean;
}

export interface SyncStats {
  readonly resourceType: string;
  readonly count: number;
  readonly pagesProcessed: number;
  readonly durationMs: number;
  readonly watermarkStart: string;
  readonly watermarkEnd: string;
}

export interface WatermarkState {
  readonly partitionKey: string;
  readonly rowKey: string;
  readonly lastUpdated: string;
  readonly etag?: string;
}

export interface TokenResponse {
  readonly access_token: string;
  readonly token_type: string;
  readonly expires_in: number;
  readonly scope?: string;
}

export interface FhirBundleLink {
  readonly relation: string;
  readonly url: string;
}

export interface FhirBundleEntry<T = unknown> {
  readonly fullUrl?: string;
  readonly resource: T;
}

export interface FhirBundle<T = unknown> {
  readonly resourceType: 'Bundle';
  readonly type: string;
  readonly total?: number;
  readonly link?: readonly FhirBundleLink[];
  readonly entry?: readonly FhirBundleEntry<T>[];
}

export interface OperationOutcomeIssue {
  readonly severity: 'fatal' | 'error' | 'warning' | 'information';
  readonly code: string;
  readonly diagnostics?: string;
}

export interface OperationOutcome {
  readonly resourceType: 'OperationOutcome';
  readonly issue: readonly OperationOutcomeIssue[];
}
