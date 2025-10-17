import { OpenEMRClient } from './openemr-client';
import { AHDSClient } from './ahds-client';

export interface SyncResult {
  success: boolean;
  resourceType: string;
  resourceId: string;
  error?: string;
}

export class FHIRSyncService {
  private openemrClient: OpenEMRClient;
  private ahdsClient: AHDSClient;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // milliseconds

  constructor(openemrClient: OpenEMRClient, ahdsClient: AHDSClient) {
    this.openemrClient = openemrClient;
    this.ahdsClient = ahdsClient;
  }

  /**
   * Retry logic for transient failures
   */
  private async retry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`${operationName} failed (attempt ${attempt}/${this.maxRetries}):`, error?.message ?? String(error));
        
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Sync a single patient from OpenEMR to AHDS
   */
  async syncPatient(patientId: string): Promise<SyncResult> {
    try {
      console.log(`Starting sync for Patient/${patientId}`);

      // Get patient from OpenEMR
      const patient = await this.retry(
        () => this.openemrClient.getFhirResource('Patient', patientId),
        `Get Patient/${patientId} from OpenEMR`
      );

      console.log(`Retrieved patient from OpenEMR:`, patient.id);

      // Push to AHDS
      await this.retry(
        () => this.ahdsClient.upsertResource(patient),
        `Upsert Patient/${patientId} to AHDS`
      );

      console.log(`Successfully synced Patient/${patientId}`);

      return {
        success: true,
        resourceType: 'Patient',
        resourceId: patientId,
      };
    } catch (error) {
      console.error(`Failed to sync Patient/${patientId}:`, error);
      return {
        success: false,
        resourceType: 'Patient',
        resourceId: patientId,
        error: error.message,
      };
    }
  }

  /**
   * Sync a single observation from OpenEMR to AHDS
   */
  async syncObservation(observationId: string): Promise<SyncResult> {
    try {
      console.log(`Starting sync for Observation/${observationId}`);

      // Get observation from OpenEMR
      const observation = await this.retry(
        () => this.openemrClient.getFhirResource('Observation', observationId),
        `Get Observation/${observationId} from OpenEMR`
      );

      console.log(`Retrieved observation from OpenEMR:`, observation.id);

      // Push to AHDS
      const result = await this.retry(
        () => this.ahdsClient.upsertResource(observation),
        `Upsert Observation/${observationId} to AHDS`
      );

      console.log(`Successfully synced Observation/${observationId}`);

      return {
        success: true,
        resourceType: 'Observation',
        resourceId: observationId,
      };
    } catch (error) {
      console.error(`Failed to sync Observation/${observationId}:`, error);
      return {
        success: false,
        resourceType: 'Observation',
        resourceId: observationId,
        error: error.message,
      };
    }
  }

  /**
   * Sync multiple patients by searching OpenEMR
   */
  async syncPatients(searchParams: Record<string, string> = {}): Promise<SyncResult[]> {
    try {
      console.log('Searching for patients in OpenEMR');
      const bundle = await this.openemrClient.searchFhirResources('Patient', searchParams);
      
      const results: SyncResult[] = [];
      
      if (bundle.entry && bundle.entry.length > 0) {
        console.log(`Found ${bundle.entry.length} patients to sync`);
        
        for (const entry of bundle.entry) {
          const patient = entry.resource;
          if (patient && patient.id) {
            const result = await this.syncPatient(patient.id);
            results.push(result);
          }
        }
      } else {
        console.log('No patients found matching search criteria');
      }
      
      return results;
    } catch (error) {
      console.error('Failed to sync patients:', error);
      throw error;
    }
  }

  /**
   * Sync observations for a specific patient
   */
  async syncObservationsForPatient(patientId: string): Promise<SyncResult[]> {
    try {
      console.log(`Searching for observations for Patient/${patientId}`);
      const bundle = await this.openemrClient.searchFhirResources('Observation', {
        patient: patientId,
      });
      
      const results: SyncResult[] = [];
      
      if (bundle.entry && bundle.entry.length > 0) {
        console.log(`Found ${bundle.entry.length} observations to sync`);
        
        for (const entry of bundle.entry) {
          const observation = entry.resource;
          if (observation && observation.id) {
            const result = await this.syncObservation(observation.id);
            results.push(result);
          }
        }
      } else {
        console.log('No observations found for patient');
      }
      
      return results;
    } catch (error) {
      console.error('Failed to sync observations:', error);
      throw error;
    }
  }
}
