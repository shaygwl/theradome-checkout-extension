import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect } from "preact/hooks";
import { detectHelmets, hasSubscriptionPlan, hasVariant, useCheckoutConfig } from "./config.js";

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
  const { variants, images, discountCodes: codes } = config;

  const cartProductWarranty =
    cartAttributes.find((attr) => attr.key === "product_warranty")?.value ?? "";

  const isQuizTaker = cartAttributes.some(
    (attr) => attr.key === "completed_quiz" && attr.value === "true"
  );

  // Check existence of individual products
  const hasHairBundle = hasVariant(cartLines, variants.hairBundle);
  const hasProWarranty = hasVariant(cartLines, variants.proWarranty);
  const hasEvoWarranty = hasVariant(cartLines, variants.evoWarranty);
  const hasEbook = hasVariant(cartLines, variants.ebook);

  // An unlisted helmet listing (e.g. a sale product) is PRO or EVO by its warranty
  const helmets = detectHelmets(cartLines, config);
  const hasProHelmet = helmets.pro || (helmets.unlisted && hasProWarranty);
  const hasEvoHelmet = helmets.evo || (helmets.unlisted && hasEvoWarranty);

  // Validate strict 4-product bundle combinations
  const isProBundleComplete = hasProHelmet && hasProWarranty && hasHairBundle && hasEbook;
  const isEvoBundleComplete = hasEvoHelmet && hasEvoWarranty && hasHairBundle && hasEbook;
  const isSubscription = hasSubscriptionPlan(cartLines, config);

  const helmetInCart = helmets.any;
  const bundleLine = cartLines.find((line) => line?.merchandise?.id === variants.hairBundle);
  const bundleInCart = Boolean(bundleLine);

  const bundleProductWarranty =
    bundleLine?.attributes?.find((attr) => attr.key === "product_warranty")?.value ??
    cartProductWarranty;

  // The auto-reapply only fills an empty checkout. Any code already applied was
  // chosen on purpose (PROBUNDLE26S after the subscription upgrade, a quiz
  // code, a Black Friday or other sale code, a test code). Adding the bundle
  // code on top of it means two codes that cannot combine, and Shopify drops
  // the one the buyer wanted.
  const hasAnyCode = discountCodes.length > 0;

  // Set target discount code ONLY if a complete bundle is present. Waits for
  // the config so a fallback code is never applied ahead of the configured one.
  // With the $0 subscription plan in the cart the S code is tried first, and
  // the regular code is the fallback if Shopify rejects it.
  let targetCode = null;
  let fallbackCode = null;
  if (ready && isProBundleComplete) {
    fallbackCode = isQuizTaker ? codes.proQuiz : codes.pro;
    targetCode = isSubscription ? (isQuizTaker ? codes.proQuizSubscription : codes.proSubscription) : fallbackCode;
  } else if (ready && isEvoBundleComplete) {
    fallbackCode = isQuizTaker ? codes.evoQuiz : codes.evo;
    targetCode = isSubscription ? (isQuizTaker ? codes.evoQuizSubscription : codes.evoSubscription) : fallbackCode;
  }

  // Auto-Reapply Logic
  useEffect(() => {
    if (!targetCode || hasAnyCode) return;

    const addCode = (code) => shopify.applyDiscountCodeChange({ type: "addDiscountCode", code });

    addCode(targetCode)
      .then((result) => {
        if (result?.type === "error" && fallbackCode && fallbackCode !== targetCode) {
          console.error(`Discount ${targetCode} rejected (${result.message}), trying ${fallbackCode}`);
          return addCode(fallbackCode);
        }
      })
      .catch((err) => console.error("Failed to reapply discount:", err));
  }, [targetCode, fallbackCode, hasAnyCode]);

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
