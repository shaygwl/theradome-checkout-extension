// @ts-check

/**
 * @typedef {import("../generated/api").CartValidationsGenerateRunInput} CartValidationsGenerateRunInput
 * @typedef {import("../generated/api").CartValidationsGenerateRunResult} CartValidationsGenerateRunResult
 */

// Only a line bought on one of these selling plans is restricted. The same
// product sold one-time or on its regular plan (691283656996) is never touched.
// Overridable per product with custom.helmet_required_selling_plans.
const FALLBACK_RESTRICTED_SELLING_PLAN_IDS = [
  "gid://shopify/SellingPlan/692041908516", // $0 first order, then $79 every 2 months
];

// What counts as a helmet when the product has no custom.requires_any_product.
// Product type also covers separate sale listings such as a Black Friday helmet.
const FALLBACK_HELMET_IDS = [
  "gid://shopify/Product/8321560084772", // Theradome PRO LH80
  "gid://shopify/Product/8321561362724", // Theradome EVO LH40
  "gid://shopify/ProductVariant/45238034825508", // Theradome PRO LH80
  "gid://shopify/ProductVariant/45238037152036", // Theradome EVO LH40
];
const FALLBACK_HELMET_PRODUCT_TYPE = "Theradome Helmet Category (NEW)";

const ERROR_MESSAGE =
  "The free first month of the Complete Hair Growth Bundle subscription is only available with a Theradome PRO or EVO helmet. Add a helmet to your order or choose a different purchase option.";

/**
 * Reads a list metafield of IDs. Accepts full GIDs, or bare numeric IDs that
 * get `gidPrefix`. Returns null when missing or empty so the fallback applies.
 * @param {any} metafield
 * @param {string} gidPrefix
 * @returns {string[] | null}
 */
function readIds(metafield, gidPrefix) {
  const value = metafield?.jsonValue;
  if (!Array.isArray(value)) return null;
  const ids = value
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .map((id) => (/^\d+$/.test(id) ? `${gidPrefix}${id}` : id))
    .filter((id) => id.startsWith("gid://shopify/"));
  return ids.length > 0 ? ids : null;
}

/**
 * @param {CartValidationsGenerateRunInput} input
 * @returns {CartValidationsGenerateRunResult}
 */
export function cartValidationsGenerateRun(input) {
  // Only enforce once the buyer is in checkout, so adding the subscription to
  // the cart before the helmet is never blocked.
  if (input.buyerJourney.step === "CART_INTERACTION") {
    return { operations: [{ validationAdd: { errors: [] } }] };
  }

  const lines = input.cart.lines.map((line) => {
    const variant = line.merchandise.__typename === "ProductVariant" ? line.merchandise : null;
    return {
      quantity: line.quantity,
      variantId: variant?.id ?? "",
      productId: variant?.product.id ?? "",
      productType: variant?.product.productType ?? "",
      sellingPlanId: line.sellingPlanAllocation?.sellingPlan.id ?? null,
      restrictedPlanIds:
        readIds(variant?.product.helmetRequiredSellingPlans, "gid://shopify/SellingPlan/") ??
        FALLBACK_RESTRICTED_SELLING_PLAN_IDS,
      requiredIds: readIds(variant?.product.requiresAnyProduct, "gid://shopify/Product/"),
    };
  });

  /** @param {string[] | null} requiredIds */
  const quantityOf = (requiredIds) =>
    lines
      .filter((line) =>
        requiredIds
          ? requiredIds.includes(line.variantId) || requiredIds.includes(line.productId)
          : FALLBACK_HELMET_IDS.includes(line.variantId) ||
            FALLBACK_HELMET_IDS.includes(line.productId) ||
            line.productType === FALLBACK_HELMET_PRODUCT_TYPE
      )
      .reduce((sum, line) => sum + line.quantity, 0);

  // Group restricted quantity by the set of products that unlocks it, so one
  // helmet covers at most one subscription.
  /** @type {Map<string, { requiredIds: string[] | null, quantity: number }>} */
  const groups = new Map();
  for (const line of lines) {
    if (!line.sellingPlanId || !line.restrictedPlanIds.includes(line.sellingPlanId)) continue;

    const key = line.requiredIds ? [...line.requiredIds].sort().join(",") : "fallback";
    const group = groups.get(key) ?? { requiredIds: line.requiredIds, quantity: 0 };
    group.quantity += line.quantity;
    groups.set(key, group);
  }

  const isValid = [...groups.values()].every(
    (group) => quantityOf(group.requiredIds) >= group.quantity
  );

  const errors = isValid ? [] : [{ message: ERROR_MESSAGE, target: "$.cart" }];

  return { operations: [{ validationAdd: { errors } }] };
}
