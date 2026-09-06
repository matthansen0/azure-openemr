import { TableClient } from '@azure/data-tables';
import type { WatermarkState } from '../types/index.js';

export class WatermarkManager {
  private client: TableClient | null = null;
  private readonly inMemoryState = new Map<string, string>();

  constructor(connectionStringOrUrl: string, tableName = 'syncwatermarks') {
    if (connectionStringOrUrl) {
      if (connectionStringOrUrl.startsWith('DefaultEndpointsProtocol=') || connectionStringOrUrl.startsWith('UseDevelopmentStorage=')) {
        this.client = TableClient.fromConnectionString(connectionStringOrUrl, tableName);
      } else {
        this.client = new TableClient(connectionStringOrUrl, tableName);
      }
    }
  }

  async getWatermark(resourceType: string): Promise<string | undefined> {
    if (!this.client) {
      return this.inMemoryState.get(resourceType);
    }

    try {
      const entity = await this.client.getEntity<WatermarkState>('watermarks', resourceType);
      return entity.lastUpdated;
    } catch {
      return undefined;
    }
  }

  async commitWatermark(resourceType: string, lastUpdatedIso: string): Promise<void> {
    if (!this.client) {
      this.inMemoryState.set(resourceType, lastUpdatedIso);
      return;
    }

    await this.client.upsertEntity({
      partitionKey: 'watermarks',
      rowKey: resourceType,
      lastUpdated: lastUpdatedIso
    }, 'Replace');
  }
}
