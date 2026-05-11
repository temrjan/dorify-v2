import { Route, Routes } from 'react-router-dom';
import { PharmacyHomePage } from './PharmacyHomePage';
import { PharmacyOnboardingPage } from './PharmacyOnboardingPage';
import { ProductsListPage } from './products/ProductsListPage';
import { ProductFormPage } from './products/ProductFormPage';
import { PharmacyOrdersPage } from './orders/PharmacyOrdersPage';
import { PaymentSettingsPage } from './payment-settings/PaymentSettingsPage';

export default function PharmacyPanelPage() {
  return (
    <Routes>
      <Route index element={<PharmacyHomePage />} />
      <Route path="onboarding" element={<PharmacyOnboardingPage />} />
      <Route path="products" element={<ProductsListPage />} />
      <Route path="products/new" element={<ProductFormPage />} />
      <Route path="products/:id/edit" element={<ProductFormPage />} />
      <Route path="orders" element={<PharmacyOrdersPage />} />
      <Route path="payment-settings" element={<PaymentSettingsPage />} />
    </Routes>
  );
}
