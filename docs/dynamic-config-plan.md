# Plan: dynamic checkout config with hardcoded fallbacks

## Where things stand

| Piece | Location | Configured by |
| --- | --- | --- |
| Header banner (desktop + mobile) | `extensions/theradome-checkout-banner/src/Header.jsx` | Hardcoded variant IDs and image URLs |
| Order-summary banner + discount auto-apply | `extensions/theradome-checkout-banner/src/Checkout.jsx` | Hardcoded variant IDs, image URLs, aspect ratios, discount codes |
| Subscription bundle validation (new) | `extensions/subscription-bundle-validation` | Product metafield `custom.requires_any_product`, falling back to hardcoded IDs |

Rule for every step below: **the current constants stay in the code as the fallback.** A field that is missing, empty or invalid in the admin uses its constant, so a half-filled config or a failed fetch makes checkout behave the same as today.

## 1. Subscription validation (implemented)

The Shopify Function blocks checkout (it does not block adding to the cart) when the $0 subscription is in the cart without a PRO or EVO helmet. It also blocks when there are more subscriptions than helmets.

- A line counts as restricted when its product has `custom.requires_any_product` set, or it is product `10336375603492`, or it uses selling plan `692041908516`.
- It needs at least as many units of the required products as restricted units.
- Required products come from `custom.requires_any_product` (a list of product or variant references). If that metafield is missing, the PRO and EVO helmet variants are used.

To make it dynamic in the admin:
1. Settings → Custom data → Products → add the definition `custom.requires_any_product`, type **list of products**.
2. On the subscription product, pick the PRO and EVO helmet products.
3. Any future bundle-only product only needs the same metafield filled in. No deploy is needed.

To go live: `shopify app deploy --config gwl-checkout-banners`, then Settings → Checkout → **Checkout rules** → add "GWL - Subscription bundle validation" and turn it on. Custom apps that use Functions need Shopify Plus.

## 2. Banners and product IDs (code implemented, metaobject not created yet)

### Data model: one `checkout_config` metaobject (a single entry)

Create the metaobject definition with **Storefront API access: read** turned on, so the extension can query it. `api_access = true` is already set in the extension toml.

| Field key | Type | Replaces |
| --- | --- | --- |
| `pro_helmet`, `evo_helmet` | Product variant | `PRO_/EVO_HELMET_VARIANT_ID` |
| `hair_bundle`, `pro_warranty`, `evo_warranty`, `ebook` | Product variant | matching `*_VARIANT_ID` |
| `header_helmet_desktop`, `header_helmet_mobile`, `header_bundle_desktop`, `header_bundle_mobile` | File (image) | `Header.jsx` URLs |
| `bundle_banner`, `bundle_banner_no_shipping` | File (image) | `BUNDLE_*` |
| `six_month_banner`, `six_month_banner_no_shipping` | File (image) | `SIX_MONTH_*` |
| `twelve_month_banner`, `twelve_month_banner_no_shipping` | File (image) | `TWELVE_MONTH_*` |
| `discount_codes` | JSON `{ pro, pro_quiz, evo, evo_quiz }` | `PROBUNDLE26`, `TQPRO26`, … |
| `protected_discount_codes` | List of single-line text | `PROTECTED_DISCOUNT_CODES` |

Image fields return `MediaImage.image { url width height }`, so the aspect ratio comes from the file itself. The hand-maintained `BANNER_ASPECT_RATIOS` map is then only needed for the fallback URLs.

We chose a single entry that only holds data, and not a rules engine (a list of "if X then show banner Y" rules), because:
- The banner-choice logic (warranty attribute, US vs non-US shipping, bundle vs helmet) stays in code, where it is tested and already works.
- Marketing can swap images and products for a campaign without a deploy.
- A field-by-field fallback is simple: each field reads `config?.field ?? CONSTANT`.

If marketing later needs brand-new conditions (for example a market-specific banner), add a `banner_rules` list on top of this. Don't replace it.

### Extension changes (done)

1. `src/config.js` is a new shared module:
   - `DEFAULT_CONFIG` holds today's constants, moved out of the two components without changing them.
   - `useCheckoutConfig()` calls `shopify.query()` once for `metaobject(handle: { type: "checkout_config", handle: "default" })`. It returns `{ config, ready }`.
   - `ready` turns true when the query resolves or fails, or after 4 seconds. Anything that arrives after the timeout is ignored, so banners and codes never change under the buyer.
   - `mergeConfig(defaults, fields)` checks each field and falls back to the default for each field on its own:
     - a variant field must be a `ProductVariant` GID;
     - an image must be on `cdn.shopify.com` and have a width and height;
     - each discount code must be non-empty text.
2. `Header.jsx` and `Checkout.jsx` read IDs, images and codes from the hook. The selection logic is unchanged.
3. Both banners render nothing until `ready`, so an old fallback image never flashes before the configured one. When no metaobject exists, this adds one Storefront API round trip before the banner appears.
4. The discount auto-apply waits for `ready`, so it never applies a fallback code ahead of the configured one.
5. Variant matching compares full GIDs (`gid://shopify/ProductVariant/…`).

### Creating the metaobject

Content → Metaobjects → Add definition:
- Name `Checkout config`, type `checkout_config`.
- Turn on **Storefront API access**. Without it the query returns nothing and checkout stays on the fallbacks.

Field types:

| Field keys | Type |
| --- | --- |
| `pro_helmet`, `evo_helmet`, `hair_bundle`, `pro_warranty`, `evo_warranty`, `ebook` | Product variant (one) |
| `header_helmet_desktop`, `header_helmet_mobile`, `header_bundle_desktop`, `header_bundle_mobile`, `bundle_banner`, `bundle_banner_no_shipping`, `six_month_banner`, `six_month_banner_no_shipping`, `twelve_month_banner`, `twelve_month_banner_no_shipping` | File (images only) |
| `discount_codes` | JSON, for example `{"pro":"PROBUNDLE26","pro_quiz":"TQPRO26","evo":"EVOBUNDLE26","evo_quiz":"TQEVO26"}`. Keys you leave out keep their default. |
| `protected_discount_codes` | Single line text (list) |

Then add one entry with the handle **`default`**. Leave any field empty to keep today's value for it.

### Rollout

1. Deploy with **no metaobject created**. Checkout must look exactly the same, which proves the fallback path works.
2. Create the definition and the `default` entry, filling it in field by field. Check in the checkout editor preview after each one.
3. Optional: a small admin settings page or an admin UI extension, if editing in Content → Metaobjects is not friendly enough.

### Test checklist

- No metaobject, metaobject with empty fields, metaobject with a broken image: all should show today's banners.
- Every banner branch: helmet only, bundle only, bundle + helmet with a 6- or 12-month warranty, US vs non-US address.
- Quiz taker vs not, and with `PROBUNDLE26TEST` applied: the codes should match today's behaviour.
