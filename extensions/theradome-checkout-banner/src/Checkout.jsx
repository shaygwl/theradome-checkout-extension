import {
  reactExtension,
  BlockStack,
  useAttributes,
  useCartLines,
  useShippingAddress,
  useDeliveryGroups,
  Image,
} from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.checkout.block.render", () => (
  <Extension />
));

function Extension() {
  const cartLines = useCartLines();
  const cartAttributes = useAttributes();
  const shippingAddress = useShippingAddress();
  const deliveryGroups = useDeliveryGroups(); // <-- Initialize the real hook

  const PRO_HELMET_VARIANT_ID = "45238034825508";
  const EVO_HELMET_VARIANT_ID = "45238037152036";
  const BUNDLE_VARIANT_ID = "51972662722852";

  const BUNDLE_CHECKOUT_BANNER =
    "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/bundle-checkout-banner.png?v=1775126842";
  const BUNDLE_NO_SHIPPING_BANNER =
    "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/bundle-checkout-banner-no-shipping.png?v=1780985632";

  const SIX_MONTH_WARRANTY_BANNER =
    "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/Row_f346b3a3-87d3-478f-93a5-f22abb11e425.png?v=1724425851";
  const SIX_MONTH_NO_SHIPPING_BANNER =
    "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/6-month-banner-no-shipping.png?v=1780985625";

  const TWELVE_MONTH_WARRANTY_BANNER =
    "https://cdn.shopify.com/s/files/1/0625/3484/4663/files/image_9.png?v=1753422637";
  const TWELVE_MONTH_NO_SHIPPING_BANNER =
    "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/12-month-banner-no-shipping.webp?v=1780985633";

  const cartProductWarranty =
    cartAttributes.find((attr) => attr.key === "product_warranty")?.value ?? "";

  const isVariantId = (merchandiseId, numericVariantId) =>
    typeof merchandiseId === "string" &&
    merchandiseId.includes("gid://shopify/ProductVariant/") &&
    merchandiseId.endsWith(`/${numericVariantId}`);

  const helmetInCart = cartLines.some((line) => {
    const id = line?.merchandise?.id;
    return (
      isVariantId(id, PRO_HELMET_VARIANT_ID) || isVariantId(id, EVO_HELMET_VARIANT_ID)
    );
  });

  const bundleLine = cartLines.find((line) =>
    isVariantId(line?.merchandise?.id, BUNDLE_VARIANT_ID),
  );
  const bundleInCart = Boolean(bundleLine);

  const bundleProductWarranty =
    bundleLine?.attributes?.find((attr) => attr.key === "product_warranty")?.value ??
    cartProductWarranty;

  // Determine if the customer is outside the US.
  let isNoShipping = false;
  const countryCode = shippingAddress?.countryCode;

  if (countryCode) {
    isNoShipping = countryCode !== "US";
  } else if (deliveryGroups && deliveryGroups.length > 0) {
    // Fallback: Check if the currently selected delivery option has a cost > 0
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

    if (warrantyToUse.includes("12 month")) {
      imageUrl = isNoShipping ? TWELVE_MONTH_NO_SHIPPING_BANNER : TWELVE_MONTH_WARRANTY_BANNER;
    } else if (warrantyToUse.includes("6 month")) {
      imageUrl = isNoShipping ? SIX_MONTH_NO_SHIPPING_BANNER : SIX_MONTH_WARRANTY_BANNER;
    }
  }

  return (
    <BlockStack>
      <Image source={imageUrl} border="base" cornerRadius="base" />
    </BlockStack>
  );
}