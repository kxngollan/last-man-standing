import { redirect } from "next/navigation";

/** Singular spelling of the board — /pick → /picks. */
export default function PickRedirect() {
  redirect("/picks");
}
