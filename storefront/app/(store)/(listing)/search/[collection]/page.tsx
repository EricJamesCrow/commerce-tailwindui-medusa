import { redirect } from "next/navigation";

export default async function LegacyCollectionRedirect(props: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = await props.params;
  redirect(`/products/${collection}`);
}
