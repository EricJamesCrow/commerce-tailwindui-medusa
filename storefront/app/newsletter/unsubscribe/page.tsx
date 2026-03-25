import { UnsubscribeForm } from "./unsubscribe-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Invalid Link</h1>
          <p className="mt-2 text-gray-500">
            This unsubscribe link is missing or malformed.
          </p>
        </div>
      </div>
    );
  }

  return <UnsubscribeForm token={token} />;
}
