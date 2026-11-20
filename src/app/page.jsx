import { redirect } from "next/navigation";

import { homePathForRole } from "@/lib/auth/roles";
import { getVerifiedSession } from "@/modules/auth";

export const dynamic = "force-dynamic";

/** Sends every visitor to the workspace their verified role allows. */
export default async function RootPage() {
  const session = await getVerifiedSession();

  if (session.status !== "authenticated" || !session.role) {
    redirect("/login");
  }

  redirect(homePathForRole(session.role));
}
