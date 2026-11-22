import type { Metadata } from "next";
import { FavoritesClient } from "./favorites-client";

export const metadata: Metadata = { title: "Favorilerim" };

export default function FavoritesPage() {
  return <FavoritesClient />;
}
