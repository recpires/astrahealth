import type { Metadata } from "next";
import { ProfileView } from "@/components/future/ProfileView";

export const metadata: Metadata = { title: "F03 · Space Health Profile" };

export default function ProfilePage() {
  return <ProfileView />;
}
