import OpengraphImage from "components/template-opengraph-image";

export const alt = "Products";

export default async function Image() {
  return await OpengraphImage({ title: "Products" });
}
