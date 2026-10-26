import { useEffect, useState } from "preact/hooks";

// Checkout config lives in a single `checkout_config` metaobject entry (handle
// `default`) that marketing edits under Content → Metaobjects. Every field
// falls back to the value below on its own, so a missing entry, an empty
// field, a broken image or a failed request all render exactly what checkout
// showed before the metaobject existed.

const CDN = "https://cdn.shopify.com/s/files/1/0721/6024/8100/files";

/** @typedef {`${number}/${number}`} AspectRatio */
/** @param {number} width @param {number} height */
const ratio = (width, height) => /** @type {AspectRatio} */ (`${width}/${height}`);

export const DEFAULT_CONFIG = {
  variants: {
    proHelmet: "gid://shopify/ProductVariant/45238034825508",
    evoHelmet: "gid://shopify/ProductVariant/45238037152036",
    hairBundle: "gid://shopify/ProductVariant/51972662722852",
    proWarranty: "gid://shopify/ProductVariant/45238043246884",
    evoWarranty: "gid://shopify/ProductVariant/45238044786980",
    ebook: "gid://shopify/ProductVariant/49994774905124",
  },
  // s-image defaults to a 1/1 frame, so each banner carries its real width/height ratio
  images: {
    headerHelmetDesktop: { url: `${CDN}/helmet-top-banner.png?v=1775127559`, aspectRatio: ratio(2180, 478) },
    headerHelmetMobile: { url: `${CDN}/helmet-top-banner-mobile.png?v=1775133598`, aspectRatio: ratio(1500, 800) },
    headerBundleDesktop: { url: `${CDN}/bundle-top-banner.png?v=1775127613`, aspectRatio: ratio(2180, 478) },
    headerBundleMobile: { url: `${CDN}/bundle-top-banner-mobile.png?v=1775133812`, aspectRatio: ratio(1500, 800) },
    bundle: { url: `${CDN}/bundle-checkout-banner.png?v=1775126842`, aspectRatio: ratio(878, 576) },
    bundleNoShipping: { url: `${CDN}/bundle-checkout-banner-no-shipping.png?v=1780985632`, aspectRatio: ratio(878, 444) },
    sixMonth: { url: `${CDN}/Row_f346b3a3-87d3-478f-93a5-f22abb11e425.png?v=1724425851`, aspectRatio: ratio(1756, 1824) },
    sixMonthNoShipping: { url: `${CDN}/6-month-banner-no-shipping.png?v=1780985625`, aspectRatio: ratio(1756, 1538) },
    twelveMonth: { url: `${CDN}/twelve_month_warranty_banner.png?v=1789390950`, aspectRatio: ratio(878, 1096) },
    twelveMonthNoShipping: { url: `${CDN}/twelve_month_warranty_banner_no_ship.png?v=1789391204`, aspectRatio: ratio(878, 964) },
  },
  discountCodes: {
    pro: "PROBUNDLE26",
    proQuiz: "TQPRO26",
    evo: "EVOBUNDLE26",
    evoQuiz: "TQEVO26",
  },
  // See the auto-reapply comment in Checkout.jsx for why these exist
  protectedDiscountCodes: ["PROBUNDLE26TEST"],
};

// Metaobject field key → config key
const VARIANT_FIELDS = {
  pro_helmet: "proHelmet",
  evo_helmet: "evoHelmet",
  hair_bundle: "hairBundle",
  pro_warranty: "proWarranty",
  evo_warranty: "evoWarranty",
  ebook: "ebook",
};

const IMAGE_FIELDS = {
  header_helmet_desktop: "headerHelmetDesktop",
  header_helmet_mobile: "headerHelmetMobile",
  header_bundle_desktop: "headerBundleDesktop",
  header_bundle_mobile: "headerBundleMobile",
  bundle_banner: "bundle",
  bundle_banner_no_shipping: "bundleNoShipping",
  six_month_banner: "sixMonth",
  six_month_banner_no_shipping: "sixMonthNoShipping",
  twelve_month_banner: "twelveMonth",
  twelve_month_banner_no_shipping: "twelveMonthNoShipping",
};

const DISCOUNT_CODE_KEYS = {
  pro: "pro",
  pro_quiz: "proQuiz",
  evo: "evo",
  evo_quiz: "evoQuiz",
};

const CONFIG_QUERY = `query CheckoutConfig {
  metaobject(handle: { type: "checkout_config", handle: "default" }) {
    fields {
      key
      value
      reference {
        __typename
        ... on MediaImage {
          image {
            url
            width
            height
          }
        }
      }
    }
  }
}`;

// Past this the remote config is ignored for the rest of the session, so the
// banner and discount codes never switch under the buyer after first render.
const CONFIG_TIMEOUT_MS = 4000;

const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;

const parseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const isCode = (value) => typeof value === "string" && value.trim() !== "";

const toImage = (reference) => {
  const image = reference?.__typename === "MediaImage" ? reference.image : null;
  const { url, width, height } = image ?? {};
  if (typeof url !== "string" || !url.startsWith("https://cdn.shopify.com/")) return null;
  if (!(width > 0 && height > 0)) return null;
  return { url, aspectRatio: ratio(width, height) };
};

export function mergeConfig(defaults, fields) {
  const config = {
    variants: { ...defaults.variants },
    images: { ...defaults.images },
    discountCodes: { ...defaults.discountCodes },
    protectedDiscountCodes: defaults.protectedDiscountCodes,
  };
  if (!Array.isArray(fields)) return config;

  for (const { key, value, reference } of fields) {
    if (key in VARIANT_FIELDS) {
      if (VARIANT_GID.test(value ?? "")) config.variants[VARIANT_FIELDS[key]] = value;
    } else if (key in IMAGE_FIELDS) {
      const image = toImage(reference);
      if (image) config.images[IMAGE_FIELDS[key]] = image;
    } else if (key === "discount_codes") {
      const codes = parseJson(value);
      for (const [remoteKey, configKey] of Object.entries(DISCOUNT_CODE_KEYS)) {
        if (isCode(codes?.[remoteKey])) config.discountCodes[configKey] = codes[remoteKey].trim();
      }
    } else if (key === "protected_discount_codes") {
      const codes = parseJson(value);
      if (Array.isArray(codes)) {
        config.protectedDiscountCodes = codes.filter(isCode).map((code) => code.trim().toUpperCase());
      }
    }
  }
  return config;
}

// Returns { config, ready }. `ready` turns true once the metaobject has loaded,
// failed or timed out; until then `config` is DEFAULT_CONFIG.
export function useCheckoutConfig() {
  const [state, setState] = useState({ config: DEFAULT_CONFIG, ready: false });

  useEffect(() => {
    let settled = false;
    const settle = (config) => {
      if (settled) return;
      settled = true;
      setState({ config, ready: true });
    };

    const timeout = setTimeout(() => settle(DEFAULT_CONFIG), CONFIG_TIMEOUT_MS);

    shopify
      .query(CONFIG_QUERY)
      .then(({ data, errors }) => {
        if (errors?.length) console.error("checkout_config query errors:", errors);
        settle(mergeConfig(DEFAULT_CONFIG, /** @type {any} */ (data)?.metaobject?.fields));
      })
      .catch((err) => {
        console.error("Failed to load checkout_config:", err);
        settle(DEFAULT_CONFIG);
      })
      .finally(() => clearTimeout(timeout));

    return () => clearTimeout(timeout);
  }, []);

  return state;
}

export const hasVariant = (lines, variantGid) =>
  lines.some((line) => line?.merchandise?.id === variantGid);
