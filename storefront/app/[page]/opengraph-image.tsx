import OpengraphImage from "components/template-opengraph-image";
import { getPage } from "lib/medusa";
import { notFound } from "next/navigation";

export default async function Image({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page: handle } = await params;
  const page = await getPage(handle);
  if (!page) {
    notFound();
  }
  const title = page.seo?.title || page.title;

  return await OpengraphImage({ title });
}
