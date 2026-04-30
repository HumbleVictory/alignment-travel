import { redirect } from "next/navigation";

export default function ConfigureIndex() {
  redirect("/configure/profile");
}