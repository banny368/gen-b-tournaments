import * as rootParams from "next/root-params";
import { notFound } from "next/navigation";
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "./routing";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import gu from "../../messages/gu.json";

const messagesByLocale: Record<Locale, typeof en> = { en, hi, gu };

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const paramValue = await rootParams.locale();
    if (hasLocale(routing.locales, paramValue)) {
      locale = paramValue;
    } else {
      notFound();
    }
  }
  return { locale, messages: messagesByLocale[locale as Locale] };
});
