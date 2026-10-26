import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { hasVariant, useCheckoutConfig } from "./config.js";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const cartLines = shopify.lines.value;
  const { config, ready } = useCheckoutConfig();

  // Hold the banner until the config settles so the fallback never flashes first
  if (!ready) return null;

  const { variants, images } = config;

  const helmetInCart =
    hasVariant(cartLines, variants.proHelmet) || hasVariant(cartLines, variants.evoHelmet);
  const bundleInCart = hasVariant(cartLines, variants.hairBundle);

  const showBundle = !helmetInCart && bundleInCart;
  const desktopBanner = showBundle ? images.headerBundleDesktop : images.headerHelmetDesktop;
  const mobileBanner = showBundle ? images.headerBundleMobile : images.headerHelmetMobile;

  // Mobile banner below 750px, desktop banner from 750px up
  return (
    <s-query-container>
      <s-box display="@container (inline-size >= 750px) none, auto">
        <s-image src={mobileBanner.url} alt="" inlineSize="fill" aspectRatio={mobileBanner.aspectRatio} />
      </s-box>
      <s-box display="@container (inline-size >= 750px) auto, none">
        <s-image src={desktopBanner.url} alt="" inlineSize="fill" aspectRatio={desktopBanner.aspectRatio} />
      </s-box>
    </s-query-container>
  );
}
