import { getNewsletterUnsubscribeToken } from "lib/medusa/cookies";
import { UnsubscribeForm } from "./unsubscribe-form";

type Props = {
  searchParams: Promise<{ flow?: string; status?: string }>;
};

export default async function UnsubscribePage({ searchParams }: Props) {
  const { flow, status } = await searchParams;
  const token = await getNewsletterUnsubscribeToken(flow);
  const safeStatus =
    token || flow
      ? null
      : status === "success" || status === "invalid-token" || status === "error"
        ? status
        : null;

  return (
    <UnsubscribeForm
      flowId={flow}
      hasToken={Boolean(token)}
      status={safeStatus}
    />
  );
}
