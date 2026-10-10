import type { PrizeType } from '@vapehard/shared';

export const CATEGORIES = [
  { slug: 'liquids', title: 'Жидкости', sortOrder: 1 },
  { slug: 'disposables', title: 'Одноразки', sortOrder: 2 },
  { slug: 'consumables', title: 'Расходники', sortOrder: 3 },
  { slug: 'pods', title: 'Под системы', sortOrder: 4 },
  { slug: 'sale', title: '🔥 Уценка', sortOrder: 5 },
] as const;

type CategorySlug = (typeof CATEGORIES)[number]['slug'];

export interface SeedProduct {
  name: string;
  category: CategorySlug;
  priceMinor: number;
  oldPriceMinor: number | null;
  description: string;
  variants: { name: string; stock: number }[];
}

export const PRODUCTS: SeedProduct[] = [
  {
    name: 'Husky Premium 30ml',
    category: 'liquids',
    priceMinor: 2800,
    oldPriceMinor: null,
    description:
      'Премиальная линейка жидкостей Husky с яркими и насыщенными фруктово-ягодными сочетаниями и фирменным кулером. Идеально подходит для POD-систем.',
    variants: [
      { name: 'Miami Snow (Мята-Клубника)', stock: 12 },
      { name: 'Yogi Dog (Гуава-Драгонфрут)', stock: 5 },
      { name: 'Big Ball (Арбуз-Медовая дыня)', stock: 0 },
      { name: 'Dark Flesh (Черника-Гуава)', stock: 8 },
    ],
  },
  {
    name: 'Vaporesso XROS 4 Mini',
    category: 'pods',
    priceMinor: 8500,
    oldPriceMinor: null,
    description:
      'Компактная и стильная POD-система со встроенным аккумулятором 1000 мАч, точной регулировкой обдува и поддержкой всех картриджей серии XROS.',
    variants: [
      { name: 'Black (Черный)', stock: 4 },
      { name: 'Silver (Серебро)', stock: 2 },
      { name: 'Ice Blue (Ледяной синий)', stock: 3 },
    ],
  },
  {
    name: 'Испаритель Vaporesso XROS Series 0.6 Ohm',
    category: 'consumables',
    priceMinor: 1200,
    oldPriceMinor: null,
    description:
      'Сменный картридж со встроенным испарителем на сетке (0.6 Ом) по технологии Corex для отличной передачи вкуса и длительного срока службы.',
    variants: [
      { name: '0.6 Ohm (Сетка)', stock: 45 },
      { name: '0.8 Ohm (Сетка)', stock: 30 },
    ],
  },
  {
    name: 'Elf Bar BC10000 Ultra',
    category: 'disposables',
    priceMinor: 5500,
    oldPriceMinor: 6500,
    description:
      'Мощное одноразовое устройство на 10 000 затяжек с информационным дисплеем уровня жидкости и заряда аккумулятора. Разъем Type-C.',
    variants: [
      { name: 'Watermelon Ice', stock: 6 },
      { name: 'Blue Razz Ice', stock: 1 },
      { name: 'Grape Cranberry', stock: 0 },
    ],
  },
  {
    name: 'Жидкость Podonki v2 (Уценка - повреждена коробка)',
    category: 'sale',
    priceMinor: 1800,
    oldPriceMinor: 2600,
    description:
      'Оригинальная жидкость Podonki v2. Уценка из-за помятой картонной упаковки при транспортировке. Флакон полностью герметичен и цел.',
    variants: [{ name: 'Ананасовый Сок (Помятая пачка)', stock: 2 }],
  },
];

export interface SeedPrize {
  key: string;
  title: string;
  label: string;
  type: PrizeType;
  amount: number;
  weight: number;
  color: string;
}

export const PRIZES: SeedPrize[] = [
  {
    key: '1BYN',
    title: 'Скидка 1 BYN',
    label: 'Скидка 1р',
    type: 'FIXED',
    amount: 100,
    weight: 160000,
    color: '#475569',
  },
  {
    key: '2BYN',
    title: 'Скидка 2 BYN',
    label: 'Скидка 2р',
    type: 'FIXED',
    amount: 200,
    weight: 160000,
    color: '#3b82f6',
  },
  {
    key: '3BYN',
    title: 'Скидка 3 BYN',
    label: 'Скидка 3р',
    type: 'FIXED',
    amount: 300,
    weight: 160000,
    color: '#0ea5e9',
  },
  {
    key: '4BYN',
    title: 'Скидка 4 BYN',
    label: 'Скидка 4р',
    type: 'FIXED',
    amount: 400,
    weight: 160000,
    color: '#14b8a6',
  },
  {
    key: '5BYN',
    title: 'Скидка 5 BYN',
    label: 'Скидка 5р',
    type: 'FIXED',
    amount: 500,
    weight: 120000,
    color: '#8b5cf6',
  },
  {
    key: '10PCT',
    title: 'Скидка 10%',
    label: 'Скидка 10%',
    type: 'PERCENT',
    amount: 10,
    weight: 120000,
    color: '#ec4899',
  },
  {
    key: '15PCT',
    title: 'Скидка 15%',
    label: 'Скидка 15%',
    type: 'PERCENT',
    amount: 15,
    weight: 118999,
    color: '#f59e0b',
  },
  {
    key: 'FREE_CARTRIDGE',
    title: 'Картридж в подарок',
    label: 'Картридж 🎁',
    type: 'GIFT',
    amount: 0,
    weight: 1000,
    color: '#10b981',
  },
  {
    key: 'FREE_XROS',
    title: 'XROS mini',
    label: 'XROS mini 🎁',
    type: 'GIFT',
    amount: 0,
    weight: 1,
    color: '#ef4444',
  },
];
