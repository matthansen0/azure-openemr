import { DefaultAzureCredential } from '@azure/identity';
import type { ObservationSummary, PatientSummary } from '../types/index.js';

export class AhdsReaderClient {
  private credential: DefaultAzureCredential;

  constructor(
    private readonly fhirUrl: string,
    credential?: DefaultAzureCredential,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.credential = credential ?? new DefaultAzureCredential();
  }

  private async getBearerToken(): Promise<string> {
    const tokenResponse = await this.credential.getToken('https://fhir.azurehealthcareapis.com/.default');
    if (!tokenResponse) {
      throw new Error('Failed to acquire Managed Identity token for AHDS FHIR service');
    }

    return tokenResponse.token;
  }

  async getPatientSummary(patientId: string): Promise<PatientSummary | null> {
    if (!/^[A-Za-z0-9.-]{1,128}$/.test(patientId)) {
      throw new Error('Invalid Patient ID format');
    }

    const bearerToken = await this.getBearerToken();
    const targetUrl = `${this.fhirUrl.replace(/\/$/, '')}/Patient/${patientId}`;

    const response = await this.fetchImpl(targetUrl, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: 'application/fhir+json'
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`AHDS FHIR query failed (${response.status})`);
    }

    const raw = (await response.json()) as {
      id?: string;
      gender?: string;
      birthDate?: string;
      name?: readonly { text?: string; family?: string; given?: readonly string[] }[];
    };

    let nameText = '';
    if (raw.name?.[0]) {
      const primaryName = raw.name[0];
      if (primaryName.text) {
        nameText = primaryName.text;
      } else if (primaryName.family) {
        nameText = `${primaryName.given?.join(' ') ?? ''} ${primaryName.family}`.trim();
      }
    }

    return {
      id: raw.id ?? patientId,
      name: nameText || undefined,
      gender: raw.gender,
      birthDate: raw.birthDate
    };
  }

  async getPatientObservations(patientId: string): Promise<readonly ObservationSummary[]> {
    if (!/^[A-Za-z0-9.-]{1,128}$/.test(patientId)) {
      throw new Error('Invalid Patient ID format');
    }

    const bearerToken = await this.getBearerToken();
    const targetUrl = `${this.fhirUrl.replace(/\/$/, '')}/Observation?subject=Patient/${patientId}&_count=50`;

    const response = await this.fetchImpl(targetUrl, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: 'application/fhir+json'
      }
    });

    if (!response.ok) {
      throw new Error(`AHDS FHIR Observation query failed (${response.status})`);
    }

    const bundle = (await response.json()) as {
      entry?: readonly {
        resource?: {
          id?: string;
          status?: string;
          effectiveDateTime?: string;
          code?: { text?: string; coding?: readonly { display?: string; code?: string }[] };
          valueQuantity?: { value?: number; unit?: string };
          valueString?: string;
        };
      }[];
    };

    const results: ObservationSummary[] = [];
    if (bundle.entry) {
      for (const entry of bundle.entry) {
        if (entry.resource) {
          const res = entry.resource;
          let codeText = res.code?.text ?? res.code?.coding?.[0]?.display ?? res.code?.coding?.[0]?.code ?? '';
          let valueText = res.valueString ?? (res.valueQuantity ? `${res.valueQuantity.value ?? ''} ${res.valueQuantity.unit ?? ''}`.trim() : '');

          results.push({
            id: res.id ?? 'unknown',
            code: codeText || undefined,
            value: valueText || undefined,
            effectiveDateTime: res.effectiveDateTime,
            status: res.status
          });
        }
      }
    }

    return results;
  }
}
