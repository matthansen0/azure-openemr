import { createHash } from 'node:crypto';

export type SupportedResourceType = 'Patient' | 'Observation';

export interface FhirResource {
  readonly resourceType: SupportedResourceType;
  readonly id?: string;
  readonly subject?: {
    readonly reference?: string;
  };
  readonly [key: string]: unknown;
}

export interface MappedResource {
  readonly resourceType: SupportedResourceType;
  readonly id: string;
  readonly meta: {
    readonly source: string;
  };
  readonly [key: string]: unknown;
}

function requireSourceId(resource: FhirResource): string {
  if (!resource.id || !/^[A-Za-z0-9.-]{1,128}$/.test(resource.id)) {
    throw new Error('FHIR resource is missing a valid source id');
  }

  return resource.id;
}

export function destinationId(sourceBaseUrl: string, resourceType: SupportedResourceType, sourceId: string): string {
  const canonicalSource = `${sourceBaseUrl.replace(/\/$/, '')}/${resourceType}/${sourceId}`;
  return createHash('sha256').update(canonicalSource).digest('hex').slice(0, 48);
}

export function mapResource(sourceBaseUrl: string, resource: FhirResource): MappedResource {
  const sourceId = requireSourceId(resource);
  const id = destinationId(sourceBaseUrl, resource.resourceType, sourceId);
  const mapped: MappedResource = {
    ...resource,
    id,
    meta: {
      source: `${sourceBaseUrl.replace(/\/$/, '')}/${resource.resourceType}/${sourceId}`
    }
  };

  if (resource.resourceType === 'Observation' && resource.subject?.reference) {
    const patientMatch = /^Patient\/([A-Za-z0-9.-]{1,128})$/.exec(resource.subject.reference);
    if (!patientMatch?.[1]) {
      throw new Error('Observation subject must reference a Patient resource');
    }

    return {
      ...mapped,
      subject: {
        reference: `Patient/${destinationId(sourceBaseUrl, 'Patient', patientMatch[1])}`
      }
    };
  }

  return mapped;
}