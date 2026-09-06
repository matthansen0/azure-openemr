export interface ViewerUserSession {
  readonly sub: string;
  readonly oid?: string;
  readonly email?: string;
  readonly exp: number;
}

export interface PatientSummary {
  readonly id: string;
  readonly name?: string;
  readonly gender?: string;
  readonly birthDate?: string;
}

export interface ObservationSummary {
  readonly id: string;
  readonly code?: string;
  readonly value?: string;
  readonly effectiveDateTime?: string;
  readonly status?: string;
}

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}
