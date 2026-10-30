/** Main header links. `end` = only "active" on exactly this URL (so Home isn't active on /products). */
export const navigationLinks = [
  { label: 'Home', to: '/', end: true },
  { label: 'Shop', to: '/products', end: false },
]
