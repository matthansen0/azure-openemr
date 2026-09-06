import { describe, expect, it, vi } from 'vitest';
import { FhirSyncService } from '../src/services/fhir-sync-service.js';
import type { OpenEmrClient } from '../src/clients/openemr-client.js';
import type { AhdsClient } from '../src/clients/ahds-client.js';
import type { WatermarkManager } from '../src/services/watermark-manager.js';

describe('FhirSyncService', () => {
  it('orchestrates reading from OpenEMR, mapping, sending to AHDS, and committing watermark', async () => {
    const openEmrClientMock = {
      fetchChangedResources: vi.fn().mockResolvedValue([
        { resourceType: 'Patient', id: 'p1' }
      ])
    } as unknown as OpenEmrClient;

    const ahdsClientMock = {
      upsertResource: vi.fn().mockResolvedValue(undefined)
    } as unknown as AhdsClient;

    const watermarkManagerMock = {
      getWatermark: vi.fn().mockResolvedValue(undefined),
      commitWatermark: vi.fn().mockResolvedValue(undefined)
    } as unknown as WatermarkManager;

    const syncService = new FhirSyncService(
      'https://openemr.example.test/fhir',
      openEmrClientMock,
      ahdsClientMock,
      watermarkManagerMock
    );

    const stats = await syncService.syncResourceType('Patient');

    expect(stats.count).toBe(1);
    expect(openEmrClientMock.fetchChangedResources).toHaveBeenCalledWith('Patient', undefined);
    expect(ahdsClientMock.upsertResource).toHaveBeenCalledTimes(1);
    expect(watermarkManagerMock.commitWatermark).toHaveBeenCalledTimes(1);
  });
});
