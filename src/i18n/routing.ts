import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "hi", "gu"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];
