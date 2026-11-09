import { describe, expect, it } from 'vitest'
import { categorySchema } from './categorySchema'

const valid = {
  name: 'Cakes',
  slug: 'cakes',
  description: '',
  sortOrder: 0,
  active: true,
}

describe('categorySchema', () => {
  it('accepts a valid category', () => {
    expect(categorySchema.safeParse(valid).success).toBe(true)
  })

  it('explains what is wrong, in plain language', () => {
    const result = categorySchema.safeParse({
      ...valid,
      name: '   ',
      slug: 'Cakes & Bakery',
      sortOrder: -1,
    })

    expect(result.success).toBe(false)
    const messages = result.error?.issues.map(
      (issue) => `${String(issue.path[0])}: ${issue.message}`,
    )
    expect(messages).toEqual([
      'name: Name is required.',
      'slug: Use only lowercase letters, numbers and single hyphens, e.g. home-kitchen.',
      'sortOrder: Sort order cannot be negative.',
    ])
  })
})
