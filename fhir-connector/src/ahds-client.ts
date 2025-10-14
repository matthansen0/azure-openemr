import axios, { AxiosInstance } from 'axios';
import { ClientSecretCredential } from '@azure/identity';

export interface AHDSConfig {
  fhirEndpoint: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export class AHDSClient {
  private axiosInstance: AxiosInstance;
  private config: AHDSConfig;
  private credential: ClientSecretCredential;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: AHDSConfig) {
    this.config = config;
    this.credential = new ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret
    );
    this.axiosInstance = axios.create({
      baseURL: config.fhirEndpoint,
      timeout: 30000,
    });
  }

  /**
   * Authenticate with Azure Health Data Services using Azure AD
   */
  async authenticate(): Promise<void> {
    try {
      const scope = `${this.config.fhirEndpoint}/.default`;
      const tokenResponse = await this.credential.getToken(scope);
      
      this.accessToken = tokenResponse.token;
      this.tokenExpiry = tokenResponse.expiresOnTimestamp;
      console.log('Successfully authenticated with Azure Health Data Services');
    } catch (error) {
      console.error('Failed to authenticate with AHDS:', error);
      throw new Error(`AHDS authentication failed: ${error.message}`);
    }
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry - 60000) {
      await this.authenticate();
    }
  }

  /**
   * Create or update a FHIR resource in AHDS
   */
  async upsertResource(resource: any): Promise<any> {
    await this.ensureAuthenticated();

    const resourceType = resource.resourceType;
    const resourceId = resource.id;

    try {
      // Use PUT for update with ID, or POST for create
      const url = resourceId 
        ? `/${resourceType}/${resourceId}`
        : `/${resourceType}`;
      
      const method = resourceId ? 'put' : 'post';
      
      const response = await this.axiosInstance[method](url, resource, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/fhir+json',
          'Accept': 'application/fhir+json',
        },
      });

      console.log(`Successfully upserted ${resourceType}/${resourceId || response.data.id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to upsert ${resourceType}:`, error.response?.data || error.message);
      throw new Error(`Failed to upsert FHIR resource: ${error.message}`);
    }
  }

  /**
   * Get a FHIR resource from AHDS
   */
  async getResource(resourceType: string, resourceId: string): Promise<any> {
    await this.ensureAuthenticated();

    try {
      const response = await this.axiosInstance.get(`/${resourceType}/${resourceId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/fhir+json',
        },
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Failed to get ${resourceType}/${resourceId}:`, error);
      throw new Error(`Failed to get FHIR resource: ${error.message}`);
    }
  }

  /**
   * Search FHIR resources in AHDS
   */
  async searchResources(resourceType: string, searchParams: Record<string, string> = {}): Promise<any> {
    await this.ensureAuthenticated();

    try {
      const params = new URLSearchParams(searchParams);
      const response = await this.axiosInstance.get(`/${resourceType}?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/fhir+json',
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Failed to search ${resourceType}:`, error);
      throw new Error(`Failed to search FHIR resources: ${error.message}`);
    }
  }
}
