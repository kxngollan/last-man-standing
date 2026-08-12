import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SocialSignupForm from "./SocialSignupForm";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false, follow: false },
};

const PROVIDERS = ["google", "apple"] as const;
type Provider = (typeof PROVIDERS)[number];

function one(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

/**
 * Where a Google/Apple sign-in lands when there's no account for that address.
 *
 * Nothing has been created at this point and nothing will be until the player
 * says so here. The address in the query is what the provider returned; it is
 * shown, and it is what the consent names, but the account is only created if
 * the provider hands us the same address again on the sign-in that follows —
 * so a doctored URL can't enrol anyone.
 */
export default async function SocialSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string | string[]; email?: string | string[] }>;
}) {
  const params = await searchParams;
  const provider = one(params.provider) as Provider;
  const email = one(params.email);

  // Arrived without the provider having said anything — nothing to confirm.
  if (!PROVIDERS.includes(provider) || !email) redirect("/login");

  return <SocialSignupForm provider={provider} email={email} />;
}
