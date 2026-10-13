import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect } from "preact/hooks";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const cartLines = shopify.lines.value;
  const cartAttributes = shopify.attributes.value;
  const shippingAddress = shopify.shippingAddress?.value;
  const deliveryGroups = shopify.deliveryGroups.value;

  const discountCodes = shopify.discountCodes.value;

  // Variant IDs
  const PRO_HELMET_VARIANT_ID = "45238034825508";
  const EVO_HELMET_VARIANT_ID = "45238037152036";
  const HAIR_GROWTH_BUNDLE_VARIANT_ID = "51972662722852";
  const PRO_WARRANTY_VARIANT_ID = "45238043246884";
  const EVO_WARRANTY_VARIANT_ID = "45238044786980";
  const EBOOK_VARIANT_ID = "49994774905124";

  // Banner URLs
  const BUNDLE_CHECKOUT_BANNER = "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/bundle-checkout-banner.png?v=1775126842";
  const BUNDLE_NO_SHIPPING_BANNER = "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/bundle-checkout-banner-no-shipping.png?v=1780985632";
  const SIX_MONTH_WARRANTY_BANNER = "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/Row_f346b3a3-87d3-478f-93a5-f22abb11e425.png?v=1724425851";
  const SIX_MONTH_NO_SHIPPING_BANNER = "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/6-month-banner-no-shipping.png?v=1780985625";
  const TWELVE_MONTH_WARRANTY_BANNER = "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/twelve_month_warranty_banner.png?v=1789390950";
  const TWELVE_MONTH_NO_SHIPPING_BANNER = "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/twelve_month_warranty_banner_no_ship.png?v=1789391204";

  // s-image defaults to a 1/1 frame, so set each banner's real width/height ratio
  const BANNER_ASPECT_RATIOS = {
    [BUNDLE_CHECKOUT_BANNER]: "878/576",
    [BUNDLE_NO_SHIPPING_BANNER]: "878/444",
    [SIX_MONTH_WARRANTY_BANNER]: "1756/1824",
    [SIX_MONTH_NO_SHIPPING_BANNER]: "1756/1538",
    [TWELVE_MONTH_WARRANTY_BANNER]: "878/1096",
    [TWELVE_MONTH_NO_SHIPPING_BANNER]: "878/964",
  };

  const cartProductWarranty =
    cartAttributes.find((attr) => attr.key === "product_warranty")?.value ?? "";

  const isQuizTaker = cartAttributes.some(
    (attr) => attr.key === "completed_quiz" && attr.value === "true"
  );

  const isVariantId = (merchandiseId, numericVariantId) =>
    typeof merchandiseId === "string" &&
    merchandiseId.includes("gid://shopify/ProductVariant/") &&
    merchandiseId.endsWith(`/${numericVariantId}`);

  // Check existence of individual products
  const hasProHelmet = cartLines.some((line) => isVariantId(line?.merchandise?.id, PRO_HELMET_VARIANT_ID));
  const hasEvoHelmet = cartLines.some((line) => isVariantId(line?.merchandise?.id, EVO_HELMET_VARIANT_ID));
  const hasHairBundle = cartLines.some((line) => isVariantId(line?.merchandise?.id, HAIR_GROWTH_BUNDLE_VARIANT_ID));
  const hasProWarranty = cartLines.some((line) => isVariantId(line?.merchandise?.id, PRO_WARRANTY_VARIANT_ID));
  const hasEvoWarranty = cartLines.some((line) => isVariantId(line?.merchandise?.id, EVO_WARRANTY_VARIANT_ID));
  const hasEbook = cartLines.some((line) => isVariantId(line?.merchandise?.id, EBOOK_VARIANT_ID));

  // Validate strict 4-product bundle combinations
  const isProBundleComplete = hasProHelmet && hasProWarranty && hasHairBundle && hasEbook;
  const isEvoBundleComplete = hasEvoHelmet && hasEvoWarranty && hasHairBundle && hasEbook;

  const helmetInCart = hasProHelmet || hasEvoHelmet;
  const bundleLine = cartLines.find((line) => isVariantId(line?.merchandise?.id, HAIR_GROWTH_BUNDLE_VARIANT_ID));
  const bundleInCart = Boolean(bundleLine);

  const bundleProductWarranty =
    bundleLine?.attributes?.find((attr) => attr.key === "product_warranty")?.value ??
    cartProductWarranty;

  // Codes the auto-reapply below must not touch. The check further down is an
  // exact match, so a code like PROBUNDLE26TEST does not read as PROBUNDLE26
  // already being applied: the extension adds PROBUNDLE26, the two cannot
  // combine, and Shopify drops the one that was deliberately applied. While
  // any of these is on the checkout the auto-reapply stands down entirely.
  const PROTECTED_DISCOUNT_CODES = ["PROBUNDLE26TEST"];

  const hasProtectedCode = discountCodes.some((dc) =>
    PROTECTED_DISCOUNT_CODES.includes(dc?.code?.toUpperCase())
  );

  // Set target discount code ONLY if a complete bundle is present
  let targetCode = null;
  if (isProBundleComplete) {
    targetCode = isQuizTaker ? "TQPRO26" : "PROBUNDLE26";
  } else if (isEvoBundleComplete) {
    targetCode = isQuizTaker ? "TQEVO26" : "EVOBUNDLE26";
  }

  // Auto-Reapply Logic
  useEffect(() => {
    if (targetCode && !hasProtectedCode) {
      const isTargetApplied = discountCodes.some(
        (dc) => dc.code.toUpperCase() === targetCode.toUpperCase()
      );

      if (!isTargetApplied) {
        shopify
          .applyDiscountCodeChange({
            type: "addDiscountCode",
            code: targetCode,
          })
          .catch((err) => console.error("Failed to reapply discount:", err));
      }
    }
  }, [targetCode, discountCodes, hasProtectedCode]);

  // Banner Logic
  let isNoShipping = false;
  const countryCode = shippingAddress?.countryCode;

  if (countryCode) {
    isNoShipping = countryCode !== "US";
  } else if (deliveryGroups && deliveryGroups.length > 0) {
    const hasShippingCost = deliveryGroups.some(group => {
      const selectedHandle = group.selectedDeliveryOption?.handle;
      const selectedOption = group.deliveryOptions.find((option) => option.handle === selectedHandle);
      const amount = selectedOption && "cost" in selectedOption ? selectedOption.cost.amount : 0;
      return Number(amount) > 0;
    });
    isNoShipping = hasShippingCost;
  }

  let imageUrl = isNoShipping ? SIX_MONTH_NO_SHIPPING_BANNER : SIX_MONTH_WARRANTY_BANNER;

  if (bundleInCart && !helmetInCart) {
    imageUrl = isNoShipping ? BUNDLE_NO_SHIPPING_BANNER : BUNDLE_CHECKOUT_BANNER;
  } else {
    const warrantyToUse = bundleInCart && helmetInCart ? bundleProductWarranty : cartProductWarranty;

    if (warrantyToUse.includes("12 month") || warrantyToUse.includes("12 months")) {
      imageUrl = isNoShipping ? TWELVE_MONTH_NO_SHIPPING_BANNER : TWELVE_MONTH_WARRANTY_BANNER;
    } else if (warrantyToUse.includes("6 month") || warrantyToUse.includes("6 months")) {
      imageUrl = isNoShipping ? SIX_MONTH_NO_SHIPPING_BANNER : SIX_MONTH_WARRANTY_BANNER;
    }
  }

  return (
    <s-stack>
      <s-image src={imageUrl} alt="" aspectRatio={BANNER_ASPECT_RATIOS[imageUrl]} border="base" borderRadius="base" />
    </s-stack>
  );
}
