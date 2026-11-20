import { confirmPasswordLink } from "@/modules/auth";

export async function GET(request) {
  return confirmPasswordLink(request);
}
