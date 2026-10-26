# Plan: dynamic checkout config with hardcoded fallbacks

## Where things stand

| Piece | Location | Configured by |
| --- | --- | --- |
| Header banner (desktop + mobile) | `extensions/theradome-checkout-banner/src/Header.jsx` | Hardcoded variant IDs and image URLs |
| Order-summary banner + discount auto-apply | `extensions/theradome-checkout-banner/src/Checkout.jsx` | Hardcoded variant IDs, image URLs, aspect ratios, discount codes |
| Subscription bundle validation (new) | `extensions/subscription-bundle-validation` | Product metafields `custom.helmet_required_selling_plans` and `custom.requires_any_product`, falling back to hardcoded IDs |

Rule for every step below: **the current constants stay in the code as the fallback.** A field that is missing, empty or invalid in the admin uses its constant, so a half-filled config or a failed fetch makes checkout behave the same as today.

## 1. Subscription validation (implemented)

The Shopify Function blocks checkout when the $0 subscription is in the cart without a PRO or EVO helmet. It also blocks when there are more $0 subscriptions than helmets. It never blocks adding to the cart.

**Only the selling plan is restricted, not the product.** Product `10336375603492` (Complete Hair Growth Bundle) is also sold on its own, one-time or on the regular plan `691283656996`. Those orders are never blocked.

- **Restricted line:** a line bought on a selling plan listed in its product's `custom.helmet_required_selling_plans`. If that metafield is empty, the list is just `692041908516`.
- **What counts as a helmet:** the products in `custom.requires_any_product`. If that metafield is empty, a helmet is PRO `8321560084772`, EVO `8321561362724`, their variants, or any product with type `Theradome Helmet Category (NEW)`. The product type is what covers separate sale listings, such as a Black Friday helmet product.
- **Quantity:** there must be at least as many helmets as restricted units.

To make it dynamic in the admin (both are optional, and empty means the fallback above):
1. Settings → Custom data → Products → add `custom.helmet_required_selling_plans`, type **single line text, list**. Enter selling plan IDs, for example `692041908516`.
2. Add `custom.requires_any_product`, type **product, list**. Pick the products that unlock the plan.
3. Fill them in on the bundle product. Changes apply without a deploy.

Tested in 17 fixtures against the compiled function. They include the real 4-product PRO bundle cart, the bundle alone (one-time and on the regular plan), a helmet with other products, and a separate Black Friday helmet listing.

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
| `discount_codes` | JSON `{ pro, pro_quiz, evo, evo_quiz, pro_subscription, pro_quiz_subscription, evo_subscription, evo_quiz_subscription }` | `PROBUNDLE26`, `TQPRO26`, `PROBUNDLE26S`, … |
| `pro_helmet_products`, `evo_helmet_products` | List of products, **added to** PRO `8321560084772` / EVO `8321561362724` | Helmet variant IDs only |
| `helmet_product_type` | Single line text | `Theradome Helmet Category (NEW)` |
| `subscription_selling_plans` | List of single-line text (plan IDs), **added to** `692041908516` | — |

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
6. **Change from the live version: the discount auto-apply only adds a bundle code when the checkout has no discount code at all.**
   - The live version adds the bundle code whenever its exact name is missing. With `PROBUNDLE26S` (after the upgrade button) it adds `PROBUNDLE26`, and with `TQPRO26S` it adds `TQPRO26`. With any sale code (Black Friday, Cyber Monday, November) it adds the bundle code on top. This was confirmed by running the live code through a test harness.
   - Any code already applied is now left alone. So there is no list of protected codes to maintain for new sale codes.
   - If the buyer removes every code from a complete bundle, the bundle code is still re-added as before.
7. **Re-added code follows the subscription.** When a bundle line is on a `subscription_selling_plans` plan ($0 plan by default), the re-added code is the `S` one: `PROBUNDLE26S`, `TQPRO26S`, `EVOBUNDLE26S` or `TQEVO26S`. If Shopify rejects that code (it doesn't exist, it expired, or it's not eligible), the regular code is tried once instead. A bundle on the regular plan `691283656996` gets the regular code.
8. **Helmet detection matches the validation.** A helmet is a listed variant, any variant of a `pro_helmet_products` / `evo_helmet_products` product, or any product with type `helmet_product_type`.
   - A helmet-type product that is in neither list (a separate Black Friday listing, for example) counts as PRO when the PRO warranty is in the cart, and as EVO when the EVO warranty is. So the banners and bundle detection work with no setup.
   - Listing the product in `pro_helmet_products` makes it explicit, if the sale helmet uses a different product type.

### Running a sale (for example Black Friday)

Nothing needs a deploy, and new codes don't need adding anywhere to stay safe. Codes already applied from the cart (`BFPROBUNDLE26`, `BFPROBUNDLE26S`, …) are always left alone.

If you also want a removed code to come back as the sale code rather than the standard one:
1. Set `discount_codes` to the sale codes, for example `{"pro":"BFPROBUNDLE26","pro_subscription":"BFPROBUNDLE26S","evo":"BFEVOBUNDLE26","evo_subscription":"BFEVOBUNDLE26S"}`. Keys you leave out, such as the quiz codes, keep their defaults.
2. If the sale helmet is a separate product with a different product type, add it to `pro_helmet_products` / `evo_helmet_products`.
3. Clear `discount_codes` after the sale. Empty means the standard codes.

The theme's upgrade-subscription button swaps codes in the cart. It's outside this repo and needs to know the sale pairs.

### Creating the metaobject

Content → Metaobjects → Add definition:
- Name `Checkout config`, type `checkout_config`.
- Turn on **Storefront API access**. Without it the query returns nothing and checkout stays on the fallbacks.

Field types:

| Field keys | Type |
| --- | --- |
| `pro_helmet`, `evo_helmet`, `hair_bundle`, `pro_warranty`, `evo_warranty`, `ebook` | Product variant (one) |
| `header_helmet_desktop`, `header_helmet_mobile`, `header_bundle_desktop`, `header_bundle_mobile`, `bundle_banner`, `bundle_banner_no_shipping`, `six_month_banner`, `six_month_banner_no_shipping`, `twelve_month_banner`, `twelve_month_banner_no_shipping` | File (images only) |
| `discount_codes` | JSON, for example `{"pro":"PROBUNDLE26","pro_quiz":"TQPRO26","evo":"EVOBUNDLE26","evo_quiz":"TQEVO26","pro_subscription":"PROBUNDLE26S","pro_quiz_subscription":"TQPRO26S","evo_subscription":"EVOBUNDLE26S","evo_quiz_subscription":"TQEVO26S"}`. Keys you leave out keep their default. |
| `pro_helmet_products`, `evo_helmet_products` | Product (list) |
| `helmet_product_type` | Single line text |
| `subscription_selling_plans` | Single line text (list) |

Then add one entry with the handle **`default`**. Leave any field empty to keep today's value for it.

### Rollout

1. Deploy with **no metaobject created**. Checkout must look exactly the same, which proves the fallback path works.
2. Create the definition and the `default` entry, filling it in field by field. Check in the checkout editor preview after each one.
3. Optional: a small admin settings page or an admin UI extension, if editing in Content → Metaobjects is not friendly enough.

### Test checklist

Automated (harness rendering the real `Checkout.jsx` and `Header.jsx` with a mocked `shopify` object; 47 scenarios pass):
- A Black Friday helmet listing shows the helmet banners and pairs with its PRO or EVO warranty.
- `S` codes are used with the $0 plan, including the quiz versions, and the regular code is the fallback when one is rejected.
- Configured sale codes are used, and `BF…` codes already applied are left alone.
- Banners show today's images when there is no metaobject, an empty metaobject, a failed query, an errored query (no Storefront access), a hung query (after 4s) or a broken image.
- A configured image replaces only its own banner.
- Auto-apply adds `PROBUNDLE26`, `TQPRO26`, `EVOBUNDLE26` or `TQEVO26` to a complete bundle with no code.
- Auto-apply leaves `PROBundle26`, `PROBUNDLE26S`, `TQPRO26S`, `EVOBUNDLE26S`, `PROBUNDLE26TEST` and sale codes alone.
- Auto-apply does nothing for an incomplete bundle, and waits for the config.

Still to check manually on a dev store or in the checkout editor before go-live:
- Every banner branch on a real checkout: helmet only, bundle only, bundle + helmet with a 6- or 12-month warranty, US vs non-US address.
- Upgrade-subscription flow: cart with `PROBUNDLE26` → upgrade → `PROBUNDLE26S` stays applied through checkout.
- On a $0-plan bundle cart, remove the code at checkout. `PROBUNDLE26S` (or `TQPRO26S`) should come back. Confirm `EVOBUNDLE26S` and `TQEVO26S` exist as codes; if they don't, the regular EVO code is used instead.
- The $0 plan without a helmet shows the validation error. The bundle on the regular plan checks out normally.
