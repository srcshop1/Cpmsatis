import { redirect } from "next/navigation";

/** Eski panel adresi artık İlanlar'a gider. */
export default function PanelPage() {
  redirect("/ilanlar");
}
