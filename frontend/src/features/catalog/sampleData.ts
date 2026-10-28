import type { Category, Product } from '../../types/catalog'

/*
 * SAMPLE DATA FOR DESIGN PREVIEW ONLY.
 * These are not real products, prices or stock. Every item has isSample: true,
 * and the UI labels it "Sample". Phase 5 replaces this file with data from
 * the backend API.
 */

export const sampleCategories: Category[] = [
  { id: 'sample-cat-1', name: 'Home & Kitchen', slug: 'home-kitchen' },
  { id: 'sample-cat-2', name: 'Fashion', slug: 'fashion' },
  { id: 'sample-cat-3', name: 'Electronics', slug: 'electronics' },
  { id: 'sample-cat-4', name: 'Beauty & Care', slug: 'beauty-care' },
]

const [home, fashion, electronics, beauty] = sampleCategories

export const sampleProducts: Product[] = [
  {
    id: 'sample-1',
    name: 'Ceramic Coffee Mug',
    slug: 'ceramic-coffee-mug',
    category: home,
    price: { amount: '1450.00', currency: 'LKR' },
    imageUrl: null,
    inStock: true,
    isSample: true,
  },
  {
    id: 'sample-2',
    name: 'Cotton Crew T-Shirt',
    slug: 'cotton-crew-t-shirt',
    category: fashion,
    price: { amount: '2900.00', currency: 'LKR' },
    imageUrl: null,
    inStock: true,
    isSample: true,
  },
  {
    id: 'sample-3',
    name: 'Wireless Earbuds',
    slug: 'wireless-earbuds',
    category: electronics,
    price: { amount: '8750.00', currency: 'LKR' },
    imageUrl: null,
    inStock: false,
    isSample: true,
  },
  {
    id: 'sample-4',
    name: 'Herbal Face Wash',
    slug: 'herbal-face-wash',
    category: beauty,
    price: { amount: '1250.00', currency: 'LKR' },
    imageUrl: null,
    inStock: true,
    isSample: true,
  },
  {
    id: 'sample-5',
    name: 'Bamboo Cutting Board',
    slug: 'bamboo-cutting-board',
    category: home,
    price: { amount: '3200.00', currency: 'LKR' },
    imageUrl: null,
    inStock: true,
    isSample: true,
  },
  {
    id: 'sample-6',
    name: 'Canvas Tote Bag',
    slug: 'canvas-tote-bag',
    category: fashion,
    price: { amount: '1990.00', currency: 'LKR' },
    imageUrl: null,
    inStock: true,
    isSample: true,
  },
  {
    id: 'sample-7',
    name: 'USB-C Charging Cable',
    slug: 'usb-c-charging-cable',
    category: electronics,
    price: { amount: '1100.00', currency: 'LKR' },
    imageUrl: null,
    inStock: true,
    isSample: true,
  },
  {
    id: 'sample-8',
    name: 'Coconut Hair Oil',
    slug: 'coconut-hair-oil',
    category: beauty,
    price: { amount: '850.00', currency: 'LKR' },
    imageUrl: null,
    inStock: true,
    isSample: true,
  },
]
