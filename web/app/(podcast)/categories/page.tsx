import { permanentRedirect } from "next/navigation";

/**
 * Category browse moved to topic chips on episodes; /categories/[slug] remains for deep links.
 */
export default function CategoriesIndexRedirect() {
  permanentRedirect("/");
}
