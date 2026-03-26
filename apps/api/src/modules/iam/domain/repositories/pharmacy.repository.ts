import type { Pharmacy } from '../entities/pharmacy.entity';

export interface PharmacyRepository {
  findById(id: string): Promise<Pharmacy | undefined>;
  findByOwnerId(ownerId: string): Promise<Pharmacy | undefined>;
  findBySlug(slug: string): Promise<Pharmacy | undefined>;
  save(pharmacy: Pharmacy): Promise<void>;
}

export const PHARMACY_REPOSITORY = Symbol('PHARMACY_REPOSITORY');
