import { Lora, Playfair_Display } from "next/font/google";

export const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});
