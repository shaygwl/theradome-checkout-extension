import {
  reactExtension,
  BlockStack,
  useApi,
  useAttributes,
} from "@shopify/ui-extensions-react/checkout";
import { Image } from "@shopify/ui-extensions/checkout";

export default reactExtension("purchase.checkout.block.render", () => (
  <Extension />
));

function Extension() {

  const { extension } = useApi();

    const cartAttributes = useAttributes();

    const product_warranty = cartAttributes.find(attr => attr.key === 'product_warranty')?.value ?? '';

    console.log(cartAttributes, "product_warranty", product_warranty);

  let imageUrl = "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/Row_f346b3a3-87d3-478f-93a5-f22abb11e425.png?v=1724425851";

  if (product_warranty.includes("6 month")) {
    imageUrl = "https://cdn.shopify.com/s/files/1/0721/6024/8100/files/Row_f346b3a3-87d3-478f-93a5-f22abb11e425.png?v=1724425851"; // 6-month image
  } else if (product_warranty.includes("12 month")) {
    imageUrl = "https://cdn.shopify.com/s/files/1/0625/3484/4663/files/image_9.png?v=1753422637"; // 12-month image
  }

  return (
    <BlockStack>
      <Image  source={imageUrl} border="base" cornerRadius="base" />
    </BlockStack>
  );

}