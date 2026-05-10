import type { StepNumber, WizardErrors, WizardState } from './types';

const PHONE_RE = /^\+?\d{9,15}$/;
const SLUG_RE = /^[a-z0-9-]+$/;

/** Validate ONLY fields belonging to the given step. Step 4 is preview-only. */
export function validateStep(state: WizardState, step: StepNumber): WizardErrors {
  const errors: WizardErrors = {};

  if (step === 1) {
    const name = state.name.trim();
    if (name.length < 2) errors.name = 'Минимум 2 символа';
    else if (name.length > 200) errors.name = 'Максимум 200 символов';

    const slug = state.slug.trim();
    if (slug.length < 2) errors.slug = 'Минимум 2 символа';
    else if (slug.length > 100) errors.slug = 'Максимум 100 символов';
    else if (!SLUG_RE.test(slug)) errors.slug = 'Только латиница, цифры, дефис';

    const phone = state.phone.replace(/[\s-()]/g, '');
    if (!PHONE_RE.test(phone)) errors.phone = 'Введите телефон в формате +998XXXXXXXXX';

    const address = state.address.trim();
    if (address.length < 5) errors.address = 'Минимум 5 символов';
    else if (address.length > 500) errors.address = 'Максимум 500 символов';
  }

  if (step === 2) {
    if (state.description.length > 2000) {
      errors.description = 'Максимум 2000 символов';
    }
    if (state.deliveryEnabled && state.deliveryPrice) {
      const price = Number(state.deliveryPrice);
      if (!Number.isFinite(price) || price < 0) {
        errors.deliveryPrice = 'Число ≥ 0';
      }
    }
  }

  if (step === 3) {
    // Multicard: all-or-nothing. If any field filled — all required.
    const anyFilled =
      state.multicardAppId.trim() ||
      state.multicardStoreId.trim() ||
      state.multicardSecret.trim();
    const allFilled =
      state.multicardAppId.trim() &&
      state.multicardStoreId.trim() &&
      state.multicardSecret.trim();
    if (anyFilled && !allFilled) {
      if (!state.multicardAppId.trim()) errors.multicardAppId = 'Заполните все 3 поля Multicard либо оставьте пустыми';
      if (!state.multicardStoreId.trim()) errors.multicardStoreId = 'Заполните все 3 поля Multicard либо оставьте пустыми';
      if (!state.multicardSecret.trim()) errors.multicardSecret = 'Заполните все 3 поля Multicard либо оставьте пустыми';
    }
  }

  if (step === 4) {
    if (!state.agreedToTerms) errors.agreedToTerms = 'Подтвердите согласие с правилами';
  }

  return errors;
}
