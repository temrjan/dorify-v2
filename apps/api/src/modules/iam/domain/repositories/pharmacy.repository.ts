import type { Pharmacy } from '../entities/pharmacy.entity';
import type { User } from '../entities/user.entity';

export interface PharmacyRepository {
  findById(id: string): Promise<Pharmacy | undefined>;
  findByOwnerId(ownerId: string): Promise<Pharmacy | undefined>;
  findBySlug(slug: string): Promise<Pharmacy | undefined>;
  save(pharmacy: Pharmacy): Promise<void>;
  /**
   * Atomic создание pharmacy + promotion owner'а в одной транзакции.
   * Закрывает audit S-CRIT-10: prior flow делал 2 save'а sequentially,
   * partial failure между ними оставлял orphan pharmacy без promoted owner.
   * P2002 unique violation (slug / ownerId duplicate) → ConflictException.
   */
  createWithOwnerPromotion(pharmacy: Pharmacy, owner: User): Promise<void>;
}

export const PHARMACY_REPOSITORY = Symbol('PHARMACY_REPOSITORY');
