import { ResetPasswordForm } from "@/components/auth/reset-password-form";

type PageProps = {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token_hash: tokenHash, type } = await searchParams;
  return <ResetPasswordForm tokenHash={tokenHash} recoveryType={type} />;
}
