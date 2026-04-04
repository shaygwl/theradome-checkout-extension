# Theradome Checkout Extension

Checkout UI extension for Theradome that renders two separate checkout banners:

- A top header banner (`purchase.checkout.header.render-after`)
- An order summary banner block (`purchase.checkout.block.render`)

## Extension Name

- `GWL - Theradome checkout banners`

## Variant IDs Used

- Pro Helmet: `45238034825508`
- Evo Helmet: `45238037152036`
- Bundle: `51972662722852`

## Banner Behavior

### 1) Header banner (top of checkout)

Source file: `extensions/theradome-checkout-banner/src/Header.jsx`

- Default banner (when no matching product state is found):
  - `https://cdn.shopify.com/s/files/1/0721/6024/8100/files/helmet-top-banner.png?v=1775127559`
- If any helmet is in cart/checkout:
  - `https://cdn.shopify.com/s/files/1/0721/6024/8100/files/helmet-top-banner.png?v=1775127559`
- If bundle is in cart/checkout and no helmet is present:
  - `https://cdn.shopify.com/s/files/1/0721/6024/8100/files/bundle-top-banner.png?v=1775127613`

**Responsive header art (viewport):** Checkout UI only supports named breakpoints on `Image` (`viewportInlineSize.min`), not arbitrary pixel widths. The header uses **mobile** images as the default and switches to **desktop** images at `min: "medium"` (not `min: "large"`, which was matching around ~1200px). Mobile URLs:

- `https://cdn.shopify.com/s/files/1/0721/6024/8100/files/helmet-top-banner-mobile.png?v=1775133598`
- `https://cdn.shopify.com/s/files/1/0721/6024/8100/files/bundle-top-banner-mobile.png?v=1775133812`

### 2) Checkout/order-summary banner block

Source file: `extensions/theradome-checkout-banner/src/Checkout.jsx`

- If bundle is in cart and helmet is NOT in cart:
  - `https://cdn.shopify.com/s/files/1/0721/6024/8100/files/bundle-checkout-banner.png?v=1775126842`
- Otherwise, warranty-based banner logic:
  - If warranty includes `6 month`:
    - `https://cdn.shopify.com/s/files/1/0721/6024/8100/files/Row_f346b3a3-87d3-478f-93a5-f22abb11e425.png?v=1724425851`
  - If warranty includes `12 month`:
    - `https://cdn.shopify.com/s/files/1/0625/3484/4663/files/image_9.png?v=1753422637`
- For helmet + bundle together, warranty is read from the bundle line first (`product_warranty`), then falls back to cart attribute.

## Targets

Configured in `extensions/theradome-checkout-banner/shopify.extension.toml`:

- `purchase.checkout.block.render` -> `./src/Checkout.jsx`
- `purchase.checkout.header.render-after` -> `./src/Header.jsx`

## Local Development

From project root:

```shell
npm run dev
```

Then preview/test in checkout editor on your development store.

## Checkout Extension Icon Note

Checkout UI extensions generally use app-level branding in the checkout editor sidebar; a per-extension custom sidebar icon is not currently configurable via `shopify.extension.toml`.

A placeholder icon asset has been added for future use:

- `extensions/theradome-checkout-banner/assets/gwl-checkout-extension-icon-placeholder.svg`

## Developed by

Akshay Dubey  
Galaxy Weblinks