import type { Category, ProductDetail, Variant } from '../../types/catalog'

/*
 * SAMPLE DATA FOR DESIGN PREVIEW ONLY. Not real products, prices or stock.
 * Shaped exactly like the backend API's JSON. Phase 5 replaces this with
 * real data from the API.
 */

function category(n: number, name: string, slug: string): Category {
  return {
    id: `sample-cat-${n}`,
    name,
    slug,
    description: null,
    imageUrl: null,
    sortOrder: n,
    active: true,
  }
}

export const sampleCategories: Category[] = [
  category(1, 'Cakes & Bakery', 'cakes-bakery'),
  category(2, 'Home & Kitchen', 'home-kitchen'),
  category(3, 'Fashion', 'fashion'),
  category(4, 'Electronics', 'electronics'),
  category(5, 'Beauty & Care', 'beauty-care'),
  category(6, 'Groceries', 'groceries'),
  category(7, 'Kids & Toys', 'kids-toys'),
  category(8, 'Sports & Outdoors', 'sports-outdoors'),
  category(9, 'Books & Stationery', 'books-stationery'),
  category(10, 'Gifts', 'gifts'),
]

function ref(slug: string) {
  const found = sampleCategories.find((c) => c.slug === slug)
  if (!found) throw new Error(`Unknown sample category ${slug}`)
  return { id: found.id, name: found.name, slug: found.slug }
}

let variantNumber = 0

/** A variant sold by the piece (whole quantities, no upper limit). */
function piece(price: string, options: Record<string, string> = {}): Variant {
  variantNumber += 1
  return {
    id: `sample-var-${variantNumber}`,
    sku: `SAMPLE-${variantNumber}`,
    price: { amount: price, currency: 'LKR' },
    saleUnit: 'PIECE',
    quantity: { min: '1', max: null, step: '1' },
    options,
    active: true,
  }
}

/** A variant sold by weight: price per kg, customer picks min…max in steps. */
function byWeight(
  pricePerKg: string,
  quantity: { min: string; max: string | null; step: string },
  options: Record<string, string> = {},
): Variant {
  return { ...piece(pricePerKg, options), saleUnit: 'KG', quantity }
}

function product(
  n: number,
  name: string,
  slug: string,
  categorySlug: string,
  description: string,
  variants: Variant[],
): ProductDetail {
  return {
    id: `sample-${n}`,
    name,
    slug,
    description,
    category: ref(categorySlug),
    status: 'ACTIVE',
    currency: 'LKR',
    variants,
  }
}

/** Newest first (the order the API returns by default). */
export const sampleProducts: ProductDetail[] = [
  product(
    1,
    'Chocolate Cake',
    'chocolate-cake',
    'cakes-bakery',
    'Moist chocolate sponge with chocolate ganache. Choose a single piece, a 1 kg cake, or any weight you need.',
    [
      piece('1200.00', { Size: '1 piece' }),
      piece('4500.00', { Size: '1 kg cake' }),
      byWeight(
        '4200.00',
        { min: '0.5', max: '5', step: '0.5' },
        { Size: 'Custom weight' },
      ),
    ],
  ),
  product(
    2,
    'Butter Cake',
    'butter-cake',
    'cakes-bakery',
    'Classic butter cake. Order a 1 kg cake or choose your own weight in 250 g steps.',
    [
      piece('3800.00', { Size: '1 kg cake' }),
      byWeight(
        '3600.00',
        { min: '1', max: '4', step: '0.25' },
        { Size: 'Custom weight' },
      ),
    ],
  ),
  product(
    3,
    'Cotton Crew T-Shirt',
    'cotton-crew-t-shirt',
    'fashion',
    'Soft everyday T-shirt in breathable cotton.',
    [
      piece('2900.00', { Size: 'S' }),
      piece('2900.00', { Size: 'M' }),
      piece('2900.00', { Size: 'L' }),
      piece('3100.00', { Size: 'XL' }),
    ],
  ),
  product(
    4,
    'Basmati Rice',
    'basmati-rice',
    'groceries',
    'Long-grain basmati rice, sold by the kilogram.',
    [byWeight('690.00', { min: '1', max: '25', step: '1' })],
  ),
  product(
    5,
    'Ceramic Coffee Mug',
    'ceramic-coffee-mug',
    'home-kitchen',
    'A sturdy 350 ml mug for everyday coffee and tea.',
    [piece('1450.00')],
  ),
  product(
    6,
    'Wireless Earbuds',
    'wireless-earbuds',
    'electronics',
    'Compact earbuds with a charging case.',
    [
      piece('8750.00', { Colour: 'Black' }),
      piece('8750.00', { Colour: 'White' }),
    ],
  ),
  product(
    7,
    'Herbal Face Wash',
    'herbal-face-wash',
    'beauty-care',
    'Gentle daily face wash with herbal extracts.',
    [
      piece('1250.00', { Size: '100 ml' }),
      piece('2100.00', { Size: '200 ml' }),
    ],
  ),
  product(
    8,
    'Bamboo Cutting Board',
    'bamboo-cutting-board',
    'home-kitchen',
    'Durable bamboo board for everyday kitchen use.',
    [piece('3200.00')],
  ),
  product(
    9,
    'Canvas Tote Bag',
    'canvas-tote-bag',
    'fashion',
    'Roomy tote bag for shopping and errands.',
    [
      piece('1990.00', { Colour: 'Natural' }),
      piece('1990.00', { Colour: 'Black' }),
    ],
  ),
  product(
    10,
    'USB-C Charging Cable',
    'usb-c-charging-cable',
    'electronics',
    'Braided USB-C cable for phones and tablets.',
    [piece('1100.00', { Length: '1 m' }), piece('1400.00', { Length: '2 m' })],
  ),
  product(
    11,
    'Coconut Hair Oil',
    'coconut-hair-oil',
    'beauty-care',
    'Pure coconut oil for hair care.',
    [piece('850.00')],
  ),
  product(
    12,
    'Building Blocks Set',
    'building-blocks-set',
    'kids-toys',
    'A 200-piece building set for creative play.',
    [piece('5400.00')],
  ),
]
