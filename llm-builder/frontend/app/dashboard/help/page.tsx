import { redirect } from "next/navigation";

/** Help is contextual per project; open a project and use Help on its home. */
export default function HelpRedirectPage() {
  redirect("/dashboard/projects");
}
