import { describe, expect, it } from 'vitest';
import { destinationId, mapResource } from '../src/services/resource-mapper.js';

const sourceBaseUrl = 'https://openemr.example.test/fhir';

describe('resource mapper', () => {
  it('derives stable IDs from the canonical source identity', () => {
    expect(destinationId(sourceBaseUrl, 'Patient', 'john-doe'))
      .toBe(destinationId(`${sourceBaseUrl}/`, 'Patient', 'john-doe'));
    expect(destinationId(sourceBaseUrl, 'Patient', 'john-doe'))
      .not.toBe(destinationId(sourceBaseUrl, 'Observation', 'john-doe'));
  });

  it('rewrites an Observation subject to the mapped Patient ID', () => {
    const mapped = mapResource(sourceBaseUrl, {
      resourceType: 'Observation',
      id: 'observation-1',
      subject: { reference: 'Patient/john-doe' },
      status: 'final'
    });

    expect(mapped.subject).toEqual({
      reference: `Patient/${destinationId(sourceBaseUrl, 'Patient', 'john-doe')}`
    });
    expect(mapped.meta.source).toBe(`${sourceBaseUrl}/Observation/observation-1`);
  });

  it('rejects an Observation with a non-Patient subject', () => {
    expect(() => mapResource(sourceBaseUrl, {
      resourceType: 'Observation',
      id: 'observation-1',
      subject: { reference: 'Encounter/encounter-1' }
    })).toThrow('Observation subject must reference a Patient resource');
  });
});