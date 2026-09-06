import type { AhdsClient } from '../clients/ahds-client.js';
import type { OpenEmrClient } from '../clients/openemr-client.js';
import { mapResource, type FhirResource } from './resource-mapper.js';
import type { WatermarkManager } from './watermark-manager.js';
import type { SyncStats } from '../types/index.js';

export class FhirSyncService {
  constructor(
    private readonly openEmrBaseUrl: string,
    private readonly openEmrClient: OpenEmrClient,
    private readonly ahdsClient: AhdsClient,
    private readonly watermarkManager: WatermarkManager
  ) {}

  async syncResourceType(resourceType: 'Patient' | 'Observation'): Promise<SyncStats> {
    const startTime = Date.now();
    const lastWatermark = await this.watermarkManager.getWatermark(resourceType);
    const nowIso = new Date().toISOString();

    const resources = await this.openEmrClient.fetchChangedResources<FhirResource>(resourceType, lastWatermark);

    let count = 0;
    for (const resource of resources) {
      const mapped = mapResource(this.openEmrBaseUrl, resource);
      await this.ahdsClient.upsertResource(mapped);
      count++;
    }

    if (resources.length > 0 || !lastWatermark) {
      await this.watermarkManager.commitWatermark(resourceType, nowIso);
    }

    return {
      resourceType,
      count,
      pagesProcessed: Math.ceil(count / 100) || 1,
      durationMs: Date.now() - startTime,
      watermarkStart: lastWatermark ?? 'none',
      watermarkEnd: nowIso
    };
  }

  async syncAll(): Promise<readonly SyncStats[]> {
    const patientStats = await this.syncResourceType('Patient');
    const observationStats = await this.syncResourceType('Observation');

    return [patientStats, observationStats];
  }
}
