import { parseTrustedRole } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/supabase/config";

import { PASSWORD_CHOOSE_PATH, PASSWORD_LINK_ERROR_PATH } from "../password-setup";
import { createRecoveryClient } from "./password-recovery";

export async function confirmPasswordLink(request) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const flowId = params.get("sb_flow_id");
  let destination = PASSWORD_LINK_ERROR_PATH;

  if (code && isSupabaseConfigured()) {
    try {
      const supabase = await createRecoveryClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );
      if (!error && data?.redirectType === "recovery" && parseTrustedRole(data.user)) {
        destination = PASSWORD_CHOOSE_PATH;
      } else if (data?.session) {
        await supabase.auth.signOut({ scope: "local" });
      }
    } catch {
      // Return to the request form when the code cannot be redeemed.
    }
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: destination,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
