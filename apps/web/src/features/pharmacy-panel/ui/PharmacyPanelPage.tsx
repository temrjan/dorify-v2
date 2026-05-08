import { Route, Routes } from 'react-router-dom';
import { PharmacyHomePage } from './PharmacyHomePage';
import { ProductsListPage } from './products/ProductsListPage';
import { ProductFormPage } from './products/ProductFormPage';

export default function PharmacyPanelPage() {
  return (
    <Routes>
      <Route index element={<PharmacyHomePage />} />
      <Route path="products" element={<ProductsListPage />} />
      <Route path="products/new" element={<ProductFormPage />} />
      <Route path="products/:id/edit" element={<ProductFormPage />} />
    </Routes>
  );
}
