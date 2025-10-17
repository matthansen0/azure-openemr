import axios, { AxiosInstance } from 'axios';

export interface OpenEMRConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export class OpenEMRClient {
  private axiosInstance: AxiosInstance;
  private config: OpenEMRConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: OpenEMRConfig) {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
    });
  }

  /**
   * Authenticate with OpenEMR using OAuth2 client credentials flow
   */
  async authenticate(): Promise<void> {
    try {
      const response = await this.axiosInstance.post('/oauth2/default/token', 
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: 'api:fhir',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
      console.log('Successfully authenticated with OpenEMR');
    } catch (error) {
      console.error('Failed to authenticate with OpenEMR:', error);
      throw new Error(`OpenEMR authentication failed: ${error?.message ?? String(error)}`);
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
   * Get FHIR resource by type and ID
   */
  async getFhirResource(resourceType: string, resourceId: string): Promise<any> {
    await this.ensureAuthenticated();

    try {
      const response = await this.axiosInstance.get(
        `/apis/default/fhir/${resourceType}/${resourceId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/fhir+json',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to get ${resourceType}/${resourceId}:`, error);
      throw new Error(`Failed to retrieve FHIR resource: ${error.message}`);
    }
  }

  /**
   * Search FHIR resources
   */
  async searchFhirResources(resourceType: string, searchParams: Record<string, string> = {}): Promise<any> {
    await this.ensureAuthenticated();

    try {
      const params = new URLSearchParams(searchParams);
      const response = await this.axiosInstance.get(
        `/apis/default/fhir/${resourceType}?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/fhir+json',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Failed to search ${resourceType}:`, error);
      throw new Error(`Failed to search FHIR resources: ${error.message}`);
    }
  }

  /**
   * Get capability statement (metadata)
   */
  async getCapabilityStatement(): Promise<any> {
    await this.ensureAuthenticated();

    try {
      const response = await this.axiosInstance.get('/apis/default/fhir/metadata', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/fhir+json',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get capability statement:', error);
      throw new Error(`Failed to get capability statement: ${error?.message ?? String(error)}`);
    }
  }
}
