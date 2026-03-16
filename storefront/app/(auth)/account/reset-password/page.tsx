import { AuthLayout } from "components/account/auth-layout";
import { ResetPasswordForm } from "components/account/reset-password-form";
import Link from "next/link";

export const metadata = { title: "Reset Password" };

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string; email?: string }>;
};

// No retrieveCustomer() guard — logged-in users clicking a reset link from email
// should still be able to reset their password (unlike login/register/forgot-password).
export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { token, email } = await searchParams;
  if (!token || !email) {
    return (
      <AuthLayout
        heading="Invalid reset link"
        subtext={
          <>
            The password reset link is invalid or has expired.{" "}
            <Link
              href="/account/forgot-password"
              className="text-primary-600 hover:text-primary-500 font-semibold"
            >
              Request a new one
            </Link>
          </>
        }
      >
        <div />
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      heading="Set a new password"
      subtext={
        <>
          Enter your new password for{" "}
          <span className="font-medium text-gray-900">{email}</span>
        </>
      }
    >
      <ResetPasswordForm token={token} email={email} />
    </AuthLayout>
  );
}
