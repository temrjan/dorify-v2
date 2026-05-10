export interface WizardState {
  // Step 1 — basic (required)
  name: string;
  slug: string;
  phone: string;
  address: string;
  license: string;

  // Step 2 — optional
  description: string;
  logoUrl: string;
  deliveryEnabled: boolean;
  deliveryPrice: string;

  // Step 3 — Multicard (optional)
  multicardAppId: string;
  multicardStoreId: string;
  multicardSecret: string;

  // Step 4
  agreedToTerms: boolean;
}

export const INITIAL_STATE: WizardState = {
  name: '',
  slug: '',
  phone: '+998',
  address: '',
  license: '',
  description: '',
  logoUrl: '',
  deliveryEnabled: false,
  deliveryPrice: '',
  multicardAppId: '',
  multicardStoreId: '',
  multicardSecret: '',
  agreedToTerms: false,
};

export type StepNumber = 1 | 2 | 3 | 4;

export type WizardErrors = Partial<Record<keyof WizardState, string>>;

export const TOTAL_STEPS: StepNumber = 4;
