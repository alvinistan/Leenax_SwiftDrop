import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { newVariant } from './features/admin/productSchema'
import * as mock from './test/mockAdminApi'
import { renderRoute } from './test/renderRoute'

/** A small fake image file (the browser only looks at its name, type and size). */
function imageFile(name: string, type = 'image/png', sizeBytes = 2_000) {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

function seedCakeProduct() {
  mock.logInMockAdmin()
  mock.seedCategory({ name: 'Cakes', slug: 'cakes' })
  return mock.seedProduct({
    categoryId: 'cat-1',
    name: 'Chocolate Cake',
    slug: 'chocolate-cake',
    description: null,
    shippingCategory: 'GENERAL' as const,
    hsCode: null,
    countryOfOrigin: 'LK',
    customsDescription: null,
    status: 'ACTIVE',
    variants: [
      {
        ...newVariant(),
        sku: 'CAKE',
        price: '1200',
        maxQuantity: null,
        options: {},
      },
    ],
  })
}

describe('admin photos', () => {
  it('uploads a product photo with a description and shows it', async () => {
    const product = seedCakeProduct()
    renderRoute(`/admin/products/${product.id}/edit`)

    const photos = await screen.findByRole('region', { name: 'Photos' })
    expect(within(photos).getByText('No photos yet.')).toBeInTheDocument()

    await userEvent.upload(
      within(photos).getByLabelText('Image file'),
      imageFile('cake.png'),
    )
    await userEvent.type(
      within(photos).getByLabelText('Description (for screen readers)'),
      'Chocolate cake with strawberries',
    )
    await userEvent.click(
      within(photos).getByRole('button', { name: 'Upload photo' }),
    )

    expect(
      await within(photos).findByRole('img', {
        name: 'Chocolate cake with strawberries',
      }),
    ).toHaveAttribute('src', 'https://images.example/cake.png')
    expect(within(photos).getByText('Main')).toBeInTheDocument()
  })

  it('refuses unsupported or oversized files before uploading', async () => {
    const product = seedCakeProduct()
    renderRoute(`/admin/products/${product.id}/edit`)
    const photos = await screen.findByRole('region', { name: 'Photos' })
    const input = within(photos).getByLabelText('Image file')

    // applyAccept: false lets the test pick a file the file picker would normally hide
    await userEvent.upload(input, imageFile('anim.gif', 'image/gif'), {
      applyAccept: false,
    })
    expect(within(photos).getByRole('alert')).toHaveTextContent(
      'Choose a JPEG, PNG or WebP image.',
    )
    expect(
      within(photos).getByRole('button', { name: 'Upload photo' }),
    ).toBeDisabled()

    await userEvent.upload(
      input,
      imageFile('huge.jpg', 'image/jpeg', 6 * 1024 * 1024),
    )
    expect(within(photos).getByRole('alert')).toHaveTextContent(
      'larger than 5 MB',
    )
  })

  it("shows the server's answer when the file's content is not an image", async () => {
    const product = seedCakeProduct()
    renderRoute(`/admin/products/${product.id}/edit`)
    const photos = await screen.findByRole('region', { name: 'Photos' })

    // Named and typed like a PNG, but the server looks inside and says no
    await userEvent.upload(
      within(photos).getByLabelText('Image file'),
      imageFile('fake.png'),
    )
    await userEvent.click(
      within(photos).getByRole('button', { name: 'Upload photo' }),
    )

    expect(await within(photos).findByRole('alert')).toHaveTextContent(
      'Upload a JPEG, PNG or WebP image.',
    )
  })

  it('deletes a photo after confirmation', async () => {
    const product = seedCakeProduct()
    product.images = [
      {
        id: 'img-1',
        url: 'https://images.example/a.png',
        altText: 'Cake slice',
      },
    ]
    renderRoute(`/admin/products/${product.id}/edit`)

    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete photo 1' }),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Delete photo' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('img', { name: 'Cake slice' }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByText('No photos yet.')).toBeInTheDocument()
  })

  it('sets and removes the round category picture', async () => {
    mock.logInMockAdmin()
    mock.seedCategory({ name: 'Cakes', slug: 'cakes' })
    renderRoute('/admin/categories/cat-1/edit')

    const picture = await screen.findByRole('region', { name: 'Picture' })
    await userEvent.upload(
      within(picture).getByLabelText('Image file'),
      imageFile('cakes.webp', 'image/webp'),
    )
    await userEvent.click(
      within(picture).getByRole('button', { name: 'Upload picture' }),
    )

    expect(
      await within(picture).findByRole('img', {
        name: 'Current category picture',
      }),
    ).toHaveAttribute('src', 'https://images.example/cakes.webp')
    await userEvent.click(
      within(picture).getByRole('button', { name: 'Remove picture' }),
    )
    await waitFor(() =>
      expect(within(picture).getByText('No picture')).toBeInTheDocument(),
    )
  })
})
