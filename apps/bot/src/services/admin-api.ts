import { config } from '../config';

/**
 * Bot-side client for admin pharmacy endpoints. Authenticates via
 * `X-Service-Token` header (PR #29 ServiceTokenGuard).
 */
export const adminApi = {
  async verifyPharmacy(pharmacyId: string): Promise<void> {
    const response = await fetch(
      `${config.API_URL.replace(/\/+$/, '')}/admin/pharmacies/${pharmacyId}/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': config.ADMIN_SERVICE_TOKEN,
        },
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`verify failed (${response.status}): ${body}`);
    }
  },

  async rejectPharmacy(pharmacyId: string, reason: string): Promise<void> {
    const response = await fetch(
      `${config.API_URL.replace(/\/+$/, '')}/admin/pharmacies/${pharmacyId}/reject`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': config.ADMIN_SERVICE_TOKEN,
        },
        body: JSON.stringify({ reason }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`reject failed (${response.status}): ${body}`);
    }
  },

  async hideProduct(productId: string, reason: string): Promise<void> {
    const response = await fetch(
      `${config.API_URL.replace(/\/+$/, '')}/admin/products/${productId}/hide`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': config.ADMIN_SERVICE_TOKEN,
        },
        body: JSON.stringify({ reason }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`hide product failed (${response.status}): ${body}`);
    }
  },
};
