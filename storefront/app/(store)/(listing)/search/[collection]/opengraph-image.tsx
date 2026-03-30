import OpengraphImage from "components/template-opengraph-image";
import { getCollection } from "lib/medusa";

export default async function Image({
  params,
}: {
  params: { collection: string };
}) {
  const collection = await getCollection(params.collection);
  const title = collection?.seo?.title || collection?.title;

  return await OpengraphImage({ title });
}
