import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "MathSmart" };

export default function LoginPage() {
  redirect("/");
}
