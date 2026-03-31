import { getNewsletterUnsubscribeToken } from "lib/medusa/cookies";
import { UnsubscribeForm } from "./unsubscribe-form";

type Props = {
  searchParams: Promise<{ status?: string }>;
};

export default async function UnsubscribePage({ searchParams }: Props) {
  const token = await getNewsletterUnsubscribeToken();
  const { status } = await searchParams;

  return (
    <UnsubscribeForm
      hasToken={Boolean(token)}
      status={
        status === "success" || status === "invalid-token" || status === "error"
          ? status
          : null
      }
    />
  );
}
