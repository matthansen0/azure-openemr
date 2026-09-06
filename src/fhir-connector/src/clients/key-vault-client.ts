import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

export class KeyVaultClient {
  private client: SecretClient | null = null;

  constructor(private readonly vaultUri: string, credential?: DefaultAzureCredential) {
    if (vaultUri) {
      const cred = credential ?? new DefaultAzureCredential();
      this.client = new SecretClient(vaultUri, cred);
    }
  }

  async getSecret(secretName: string): Promise<string> {
    if (!this.client) {
      throw new Error('Key Vault client is not configured');
    }

    const secret = await this.client.getSecret(secretName);
    if (!secret.value) {
      throw new Error(`Secret ${secretName} is empty or unreadable`);
    }

    return secret.value;
  }
}
