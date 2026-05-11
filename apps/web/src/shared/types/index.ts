export type ProductStatus =
  | 'DRAFT'
  | 'PENDING_MODERATION'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'HIDDEN'
  | 'EXPIRED';

export interface Product {
  id: string;
  pharmacyId: string;
  name: string;
  description?: string;
  activeSubstance?: string;
  manufacturer?: string;
  barcode?: string;
  category?: string;
  price: number;
  imageUrl?: string;
  ikpu?: string;
  packageCode?: string;
  vat?: number;
  stock: number;
  isAvailable: boolean;
  requiresPrescription: boolean;
  status: ProductStatus;
  moderationNote?: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  priceAtTime: number;
  subtotal: number;
}

export type OrderStatus =
  | 'PENDING'
  | 'PENDING_MANUAL_CONTACT'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'EXPIRED';

export type DeliveryType = 'PICKUP' | 'DELIVERY';

export interface Order {
  id: string;
  pharmacyId: string;
  buyerId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  deliveryType: DeliveryType;
  deliveryAddress?: string;
  contactPhone: string;
  comment?: string;
  items: OrderItem[];
  createdAt: string;
}

export interface Pharmacy {
  id: string;
  name: string;
  slug: string;
  description?: string;
  address: string;
  phone: string;
  logo?: string;
  isActive: boolean;
  isVerified: boolean;
  deliveryEnabled: boolean;
  deliveryPrice?: number;
  hasPaymentSettings: boolean;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Payment {
  id: string;
  orderId: string;
  status: string;
  amount: number;
  checkoutUrl?: string;
  receiptUrl?: string;
  paidAt?: string;
  createdAt: string;
}
