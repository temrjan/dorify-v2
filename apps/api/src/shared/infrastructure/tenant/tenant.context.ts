import { AsyncLocalStorage } from 'async_hooks';
import { ForbiddenException } from '@nestjs/common';

interface TenantStore {
  pharmacyId?: string;
  userId: string;
  userRole: string;
}

export class TenantContext {
  private static storage = new AsyncLocalStorage<TenantStore>();

  static run<T>(store: TenantStore, callback: () => T): T {
    return TenantContext.storage.run(store, callback);
  }

  static getPharmacyId(): string | undefined {
    return TenantContext.storage.getStore()?.pharmacyId;
  }

  static requirePharmacyId(): string {
    const pharmacyId = TenantContext.getPharmacyId();
    if (!pharmacyId) {
      throw new ForbiddenException('Pharmacy context required');
    }
    return pharmacyId;
  }

  static getUserId(): string {
    const userId = TenantContext.storage.getStore()?.userId;
    if (!userId) {
      throw new ForbiddenException('User context required');
    }
    return userId;
  }

  static getUserRole(): string {
    return TenantContext.storage.getStore()?.userRole ?? 'USER';
  }
}
