import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spinner } from '@telegram-apps/telegram-ui';

const HomePage = lazy(() => import('@features/home/ui/HomePage'));
const ProductPage = lazy(() => import('@features/product/ui/ProductPage'));
const SearchPage = lazy(() => import('@features/search/ui/SearchPage'));
const CartPage = lazy(() => import('@features/cart/ui/CartPage'));
const CheckoutPage = lazy(() => import('@features/checkout/ui/CheckoutPage'));
const OrdersPage = lazy(() => import('@features/orders/ui/OrdersPage'));
const PharmacyPanelPage = lazy(() => import('@features/pharmacy-panel/ui/PharmacyPanelPage'));

function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner size="m" />
    </div>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/pharmacy/*" element={<PharmacyPanelPage />} />
      </Routes>
    </Suspense>
  );
}
