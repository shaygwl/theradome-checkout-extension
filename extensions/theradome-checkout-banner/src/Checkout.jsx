import { useEffect } from "react";
import {
  reactExtension,
  BlockStack,
  useAttributes,
  useCartLines,
  useShippingAddress,
  useDeliveryGroups,
  Image,
  useDiscountCodes,
  useApplyDiscountCodeChange,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.checkout.block.render", () => (
  <Extension />
));

function Extension() {
  const cartLines = useCartLines();
  const cartAttributes = useAttributes();
  const shippingAddress = useShippingAddress();
  const deliveryGroups = useDeliveryGroups();
  
  const discountCodes = useDiscountCodes();
  const applyDiscountCodeChange = useApplyDiscountCodeChange();

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

  // Set target discount code ONLY if a complete bundle is present
  let targetCode = null;
  if (isProBundleComplete) {
    targetCode = isQuizTaker ? "TQPRO26" : "PROBUNDLE26";
  } else if (isEvoBundleComplete) {
    targetCode = isQuizTaker ? "TQEVO26" : "EVOBUNDLE26";
  }

  // Auto-Reapply Logic
  useEffect(() => {
    if (targetCode) {
      const isTargetApplied = discountCodes.some(
        (dc) => dc.code.toUpperCase() === targetCode.toUpperCase()
      );

      if (!isTargetApplied) {
        applyDiscountCodeChange({
          type: "addDiscountCode",
          code: targetCode,
        }).catch((err) => console.error("Failed to reapply discount:", err));
      }
    }
  }, [targetCode, discountCodes, applyDiscountCodeChange]);

  // Banner Logic
  let isNoShipping = false;
  const countryCode = shippingAddress?.countryCode;

  if (countryCode) {
    isNoShipping = countryCode !== "US";
  } else if (deliveryGroups && deliveryGroups.length > 0) {
    const hasShippingCost = deliveryGroups.some(group => {
      const amount = group.selectedDeliveryOption?.cost?.amount ?? 0;
      return parseFloat(amount) > 0;
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
    <BlockStack>
      <Image source={imageUrl} border="base" cornerRadius="base" />
    </BlockStack>
  );
}