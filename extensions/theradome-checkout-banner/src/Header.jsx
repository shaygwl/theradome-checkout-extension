import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const cartLines = shopify.lines.value;

  const PRO_HELMET_VARIANT_ID = "45238034825508";
  const EVO_HELMET_VARIANT_ID = "45238037152036";
  const BUNDLE_VARIANT_ID = "51972662722852";

  const HELMET_TOP_BANNER =
    "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/helmet-top-banner.png?v=1775127559";
  const BUNDLE_TOP_BANNER =
    "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/bundle-top-banner.png?v=1775127613";
  const HELMET_TOP_BANNER_MOBILE =
    "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/helmet-top-banner-mobile.png?v=1775133598";
  const BUNDLE_TOP_BANNER_MOBILE =
    "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/bundle-top-banner-mobile.png?v=1775133812";

  const isVariantId = (merchandiseId, numericVariantId) =>
    typeof merchandiseId === "string" &&
    merchandiseId.includes("gid://shopify/ProductVariant/") &&
    merchandiseId.endsWith(`/${numericVariantId}`);

  const helmetInCart = cartLines.some((line) => {
    const id = line?.merchandise?.id;
    return (
      isVariantId(id, PRO_HELMET_VARIANT_ID) ||
      isVariantId(id, EVO_HELMET_VARIANT_ID)
    );
  });

  const bundleInCart = cartLines.some((line) =>
    isVariantId(line?.merchandise?.id, BUNDLE_VARIANT_ID),
  );

  const desktopTopHeaderImageUrl = helmetInCart
    ? HELMET_TOP_BANNER
    : bundleInCart
      ? BUNDLE_TOP_BANNER
      : HELMET_TOP_BANNER;
  const mobileTopHeaderImageUrl = helmetInCart
    ? HELMET_TOP_BANNER_MOBILE
    : bundleInCart
      ? BUNDLE_TOP_BANNER_MOBILE
      : HELMET_TOP_BANNER_MOBILE;

  // s-image defaults to a 1/1 frame, so set each banner's real width/height ratio
  const DESKTOP_BANNER_ASPECT_RATIO = "2180/478";
  const MOBILE_BANNER_ASPECT_RATIO = "1500/800";

  // Mobile banner below 750px, desktop banner from 750px up
  return (
    <s-query-container>
      <s-box display="@container (inline-size >= 750px) none, auto">
        <s-image src={mobileTopHeaderImageUrl} alt="" inlineSize="fill" aspectRatio={MOBILE_BANNER_ASPECT_RATIO} />
      </s-box>
      <s-box display="@container (inline-size >= 750px) auto, none">
        <s-image src={desktopTopHeaderImageUrl} alt="" inlineSize="fill" aspectRatio={DESKTOP_BANNER_ASPECT_RATIO} />
      </s-box>
    </s-query-container>
  );
}
