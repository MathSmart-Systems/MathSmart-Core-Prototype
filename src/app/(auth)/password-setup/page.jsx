import { PasswordSetup } from "@/modules/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your password | MathSmart" };

export default async function PasswordSetupPage({ searchParams }) {
  return <PasswordSetup params={await searchParams} />;
}
