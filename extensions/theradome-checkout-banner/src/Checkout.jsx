import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect } from "preact/hooks";
import { hasVariant, useCheckoutConfig } from "./config.js";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const cartLines = shopify.lines.value;
  const cartAttributes = shopify.attributes.value;
  const shippingAddress = shopify.shippingAddress?.value;
  const deliveryGroups = shopify.deliveryGroups.value;

  const discountCodes = shopify.discountCodes.value;

  const { config, ready } = useCheckoutConfig();
  const { variants, images, discountCodes: codes, protectedDiscountCodes } = config;

  const cartProductWarranty =
    cartAttributes.find((attr) => attr.key === "product_warranty")?.value ?? "";

  const isQuizTaker = cartAttributes.some(
    (attr) => attr.key === "completed_quiz" && attr.value === "true"
  );

  // Check existence of individual products
  const hasProHelmet = hasVariant(cartLines, variants.proHelmet);
  const hasEvoHelmet = hasVariant(cartLines, variants.evoHelmet);
  const hasHairBundle = hasVariant(cartLines, variants.hairBundle);
  const hasProWarranty = hasVariant(cartLines, variants.proWarranty);
  const hasEvoWarranty = hasVariant(cartLines, variants.evoWarranty);
  const hasEbook = hasVariant(cartLines, variants.ebook);

  // Validate strict 4-product bundle combinations
  const isProBundleComplete = hasProHelmet && hasProWarranty && hasHairBundle && hasEbook;
  const isEvoBundleComplete = hasEvoHelmet && hasEvoWarranty && hasHairBundle && hasEbook;

  const helmetInCart = hasProHelmet || hasEvoHelmet;
  const bundleLine = cartLines.find((line) => line?.merchandise?.id === variants.hairBundle);
  const bundleInCart = Boolean(bundleLine);

  const bundleProductWarranty =
    bundleLine?.attributes?.find((attr) => attr.key === "product_warranty")?.value ??
    cartProductWarranty;

  // Codes the auto-reapply below must not touch. The check further down is an
  // exact match, so a code like PROBUNDLE26TEST does not read as PROBUNDLE26
  // already being applied: the extension adds PROBUNDLE26, the two cannot
  // combine, and Shopify drops the one that was deliberately applied. While
  // any of these is on the checkout the auto-reapply stands down entirely.
  const hasProtectedCode = discountCodes.some((dc) =>
    protectedDiscountCodes.includes(dc?.code?.toUpperCase())
  );

  // Set target discount code ONLY if a complete bundle is present. Waits for
  // the config so a fallback code is never applied ahead of the configured one.
  let targetCode = null;
  if (ready && isProBundleComplete) {
    targetCode = isQuizTaker ? codes.proQuiz : codes.pro;
  } else if (ready && isEvoBundleComplete) {
    targetCode = isQuizTaker ? codes.evoQuiz : codes.evo;
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

  // Hold the banner until the config settles so the fallback never flashes first
  if (!ready) return null;

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

  let banner = isNoShipping ? images.sixMonthNoShipping : images.sixMonth;

  if (bundleInCart && !helmetInCart) {
    banner = isNoShipping ? images.bundleNoShipping : images.bundle;
  } else {
    const warrantyToUse = bundleInCart && helmetInCart ? bundleProductWarranty : cartProductWarranty;

    if (warrantyToUse.includes("12 month") || warrantyToUse.includes("12 months")) {
      banner = isNoShipping ? images.twelveMonthNoShipping : images.twelveMonth;
    } else if (warrantyToUse.includes("6 month") || warrantyToUse.includes("6 months")) {
      banner = isNoShipping ? images.sixMonthNoShipping : images.sixMonth;
    }
  }

  return (
    <s-stack>
      <s-image src={banner.url} alt="" aspectRatio={banner.aspectRatio} border="base" borderRadius="base" />
    </s-stack>
  );
}
