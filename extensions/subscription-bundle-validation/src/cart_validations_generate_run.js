// @ts-check

/**
 * @typedef {import("../generated/api").CartValidationsGenerateRunInput} CartValidationsGenerateRunInput
 * @typedef {import("../generated/api").CartValidationsGenerateRunResult} CartValidationsGenerateRunResult
 */

// Fallback rule, used for any bundle-only product that has no
// custom.requires_any_product metafield. Keeps today's behaviour working even
// if the metafield is never filled in or is cleared by mistake.
const FALLBACK_RESTRICTED_PRODUCT_IDS = [
  "gid://shopify/Product/10336375603492", // Complete Hair Loss Treatment Bundle (subscription)
];
const FALLBACK_RESTRICTED_SELLING_PLAN_IDS = [
  "gid://shopify/SellingPlan/692041908516", // $0 first order, then $79 every 2 months
];
const FALLBACK_REQUIRED_IDS = [
  "gid://shopify/ProductVariant/45238034825508", // Theradome PRO helmet
  "gid://shopify/ProductVariant/45238037152036", // Theradome EVO helmet
];

const ERROR_MESSAGE =
  "The Complete Hair Loss Treatment Bundle subscription is only available with a Theradome PRO or EVO helmet. Add a helmet to your order or remove the subscription.";

/**
 * Reads custom.requires_any_product (list.product_reference or
 * list.variant_reference). Returns null when it is missing or unusable so the
 * caller falls back to the hardcoded rule.
 * @param {any} metafield
 * @returns {string[] | null}
 */
function readRequiredIds(metafield) {
  const value = metafield?.jsonValue;
  if (!Array.isArray(value)) return null;
  const ids = value.filter((id) => typeof id === "string" && id.startsWith("gid://shopify/"));
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
      variantId: variant?.id ?? null,
      productId: variant?.product.id ?? null,
      sellingPlanId: line.sellingPlanAllocation?.sellingPlan.id ?? null,
      requiredIds: readRequiredIds(variant?.product.requiresAnyProduct),
    };
  });

  /** @param {string[]} ids */
  const quantityOf = (ids) =>
    lines
      .filter((line) => ids.includes(line.variantId ?? "") || ids.includes(line.productId ?? ""))
      .reduce((sum, line) => sum + line.quantity, 0);

  // Group restricted quantity by the set of products that unlocks it, so one
  // helmet covers at most one subscription.
  /** @type {Map<string, { requiredIds: string[], quantity: number }>} */
  const groups = new Map();
  for (const line of lines) {
    const isFallbackRestricted =
      FALLBACK_RESTRICTED_PRODUCT_IDS.includes(line.productId ?? "") ||
      FALLBACK_RESTRICTED_SELLING_PLAN_IDS.includes(line.sellingPlanId ?? "");
    if (!line.requiredIds && !isFallbackRestricted) continue;

    const requiredIds = line.requiredIds ?? FALLBACK_REQUIRED_IDS;
    const key = [...requiredIds].sort().join(",");
    const group = groups.get(key) ?? { requiredIds, quantity: 0 };
    group.quantity += line.quantity;
    groups.set(key, group);
  }

  const isValid = [...groups.values()].every(
    (group) => quantityOf(group.requiredIds) >= group.quantity
  );

  const errors = isValid ? [] : [{ message: ERROR_MESSAGE, target: "$.cart" }];

  return { operations: [{ validationAdd: { errors } }] };
}
