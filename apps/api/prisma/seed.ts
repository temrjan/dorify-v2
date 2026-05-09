/**
 * Demo seed для dev / staging.
 *
 * Создаёт:
 *   - 1 user (PHARMACY_OWNER) — telegramId из env DEMO_PHARMACY_OWNER_TG_ID,
 *     иначе аргумент "8503214095" (Captain Тимур).
 *   - 1 pharmacy «Аптека Дорифай» — owned by user, active+verified.
 *   - 7 products с разными статусами для visual testing.
 *
 * Запуск:
 *   pnpm --filter @dorify/api prisma:seed
 *   # или явно:
 *   DEMO_PHARMACY_OWNER_TG_ID=123 pnpm --filter @dorify/api prisma:seed
 *
 * Idempotent: повторный запуск не дублирует данные (upsert по уникальным
 * полям telegramId / pharmacy.slug).
 */
import { PrismaClient, ProductStatus, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_OWNER_TG_ID = '8503214095';
const PHARMACY_SLUG = 'dorify-demo';

interface SeedProduct {
  name: string;
  description: string;
  activeSubstance?: string;
  manufacturer?: string;
  category?: string;
  price: number;
  imageUrl?: string;
  ikpu?: string;
  packageCode?: string;
  vat?: number;
  stock: number;
  status: ProductStatus;
  moderationNote?: string;
}

const PRODUCTS: SeedProduct[] = [
  {
    name: 'Парацетамол 500мг',
    description: 'Жаропонижающее и обезболивающее средство. 10 таблеток в упаковке.',
    activeSubstance: 'Paracetamolum',
    manufacturer: 'Фармстандарт',
    category: 'Жаропонижающие',
    price: 25000,
    ikpu: '04901001003000000',
    packageCode: '1506113',
    vat: 12,
    stock: 50,
    status: ProductStatus.PUBLISHED,
  },
  {
    name: 'Витамин C 500мг',
    description: 'Аскорбиновая кислота для иммунной системы. 30 таблеток.',
    activeSubstance: 'Ascorbic acid',
    manufacturer: 'Solgar',
    category: 'Витамины',
    price: 85000,
    ikpu: '21062102009000000',
    packageCode: '1506115',
    vat: 12,
    stock: 12,
    status: ProductStatus.PUBLISHED,
  },
  {
    name: 'Ибупрофен 200мг',
    description: 'Нестероидное противовоспалительное средство. 20 таблеток.',
    activeSubstance: 'Ibuprofenum',
    manufacturer: 'Hemofarm',
    category: 'Обезболивающие',
    price: 32000,
    ikpu: '04901001005000000',
    packageCode: '1506113',
    vat: 12,
    stock: 30,
    status: ProductStatus.PENDING_MODERATION,
  },
  {
    name: 'Амоксициллин 500мг',
    description: 'Антибиотик широкого спектра.',
    activeSubstance: 'Amoxicillinum',
    manufacturer: 'KRKA',
    category: 'Антибиотики',
    price: 95000,
    stock: 20,
    status: ProductStatus.REJECTED,
    moderationNote: 'Отсутствует ИКПУ и код упаковки. Заполните OFD-данные и отправьте на повторную модерацию.',
  },
  {
    name: 'Омега-3 1000мг',
    description: 'Капсулы рыбьего жира. 60 капсул.',
    manufacturer: 'NowFoods',
    category: 'БАД',
    price: 180000,
    stock: 8,
    status: ProductStatus.DRAFT,
  },
  {
    name: 'Кетопрофен гель 5%',
    description: 'Гель для наружного применения.',
    activeSubstance: 'Ketoprofenum',
    manufacturer: 'Sandoz',
    category: 'Обезболивающие',
    price: 48000,
    stock: 0,
    status: ProductStatus.HIDDEN,
  },
  {
    name: 'Магний B6',
    description: 'Магний с витамином B6. 50 таблеток.',
    manufacturer: 'Sanofi',
    category: 'Витамины',
    price: 110000,
    stock: 25,
    status: ProductStatus.HIDDEN,
  },
];

async function main(): Promise<void> {
  const ownerTgIdRaw = process.env.DEMO_PHARMACY_OWNER_TG_ID ?? DEFAULT_OWNER_TG_ID;
  const ownerTgId = BigInt(ownerTgIdRaw);

  console.log(`[seed] Owner Telegram ID: ${ownerTgId}`);

  // 1. Pharmacy owner user
  const owner = await prisma.user.upsert({
    where: { telegramId: ownerTgId },
    create: {
      telegramId: ownerTgId,
      firstName: 'Тимур',
      username: 'temrjan',
      languageCode: 'ru',
      role: UserRole.PHARMACY_OWNER,
    },
    update: {
      role: UserRole.PHARMACY_OWNER,
    },
  });
  console.log(`[seed] User upserted: ${owner.id} (${owner.firstName})`);

  // 2. Pharmacy
  const pharmacy = await prisma.pharmacy.upsert({
    where: { slug: PHARMACY_SLUG },
    create: {
      ownerId: owner.id,
      name: 'Аптека Дорифай Демо',
      slug: PHARMACY_SLUG,
      description: 'Демо-аптека для разработки и тестирования.',
      address: 'Ташкент, ул. Демонстрационная, 1',
      phone: '+998901234567',
      isActive: true,
      isVerified: true,
      deliveryEnabled: true,
      deliveryPrice: 15000,
    },
    update: {
      ownerId: owner.id,
    },
  });
  console.log(`[seed] Pharmacy upserted: ${pharmacy.id} (${pharmacy.name})`);

  // 3. Products — clear existing demo products, then create.
  // Idempotent strategy: delete by pharmacyId first (since products don't
  // have stable unique key besides id).
  const removed = await prisma.product.deleteMany({
    where: { pharmacyId: pharmacy.id },
  });
  if (removed.count > 0) {
    console.log(`[seed] Removed ${removed.count} existing products to refresh seed data`);
  }

  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        pharmacyId: pharmacy.id,
        name: p.name,
        description: p.description,
        activeSubstance: p.activeSubstance,
        manufacturer: p.manufacturer,
        category: p.category,
        price: p.price,
        imageUrl: p.imageUrl,
        ikpu: p.ikpu,
        packageCode: p.packageCode,
        vat: p.vat,
        stock: p.stock,
        isAvailable: p.stock > 0,
        status: p.status,
        moderationNote: p.moderationNote,
      },
    });
    console.log(`[seed]   - ${p.status.padEnd(20)} ${product.name}`);
  }

  console.log(`\n[seed] Done. Login as Telegram user ${ownerTgId} to access /pharmacy.`);
}

main()
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
