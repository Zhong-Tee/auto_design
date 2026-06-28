import type { Profile } from "@/types/database";

export function formatProfileLabel(
  profile: Pick<Profile, "display_name" | "email"> | null | undefined
): string {
  if (!profile) return "-";
  return profile.display_name?.trim() || profile.email;
}
