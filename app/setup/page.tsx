// app/setup/page.tsx
import { redirect } from "next/navigation";

export default function SetupPage() {
  redirect("/configure/setup");
}