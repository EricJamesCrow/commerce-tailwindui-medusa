type Status = "success" | "invalid-token" | "error" | null;

export function UnsubscribeForm({
  flowId,
  hasToken,
  status,
}: {
  flowId?: string;
  hasToken: boolean;
  status: Status;
}) {
  if (status === "success") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            You've been unsubscribed
          </h1>
          <p className="mt-2 text-gray-500">
            You won't receive any more newsletter emails from us.
          </p>
        </div>
      </div>
    );
  }

  if (status === "invalid-token" || status === "error") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Something went wrong
          </h1>
          <p className="mt-2 text-gray-500">
            {status === "invalid-token"
              ? "This unsubscribe link is invalid or has expired. Please use the link in your most recent email."
              : "We couldn't process your request. Please try again or contact support."}
          </p>
        </div>
      </div>
    );
  }

  if (!hasToken) {
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

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Unsubscribe from newsletter
        </h1>
        <p className="mt-2 text-gray-500">
          Click below to stop receiving newsletter emails.
        </p>
        <form
          action="/newsletter/unsubscribe/confirm"
          method="post"
          className="mt-6"
        >
          {flowId ? <input type="hidden" name="flow" value={flowId} /> : null}
          <button
            type="submit"
            className="bg-primary-600 hover:bg-primary-700 rounded-md px-6 py-2 text-sm font-medium text-white"
          >
            Confirm unsubscribe
          </button>
        </form>
      </div>
    </div>
  );
}
