import { UnsubscribeForm } from "./unsubscribe-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (token) {
    const serializedToken = JSON.stringify(token);

    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              sessionStorage.setItem(
                "__newsletter_unsubscribe_token",
                ${serializedToken}
              );
              window.location.replace("/newsletter/unsubscribe");
            `,
          }}
        />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Preparing unsubscribe
          </h1>
          <p className="mt-2 text-gray-500">
            Redirecting to a secure unsubscribe page.
          </p>
        </div>
      </div>
    );
  }

  return <UnsubscribeForm token={null} />;
}
