import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Inter } from "next/font/google";
import { getSettings } from "@/lib/queries/settings";
import { getHeaderCategories } from "@/lib/queries/categories";
import { getActiveThemeSlug } from "@/lib/queries/themes";
import { Header } from "@/components/Header";
import { Nav } from "@/components/Nav";
import { FooterStream } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { siteMetadata, websiteJsonLd, organizationJsonLd } from "@/lib/seo";
import { readColorPreference, resolveColorMode } from "@/lib/theme-mode";
import { brandColorsCss } from "@/lib/brand-colors";
import { htmlLang } from "@/lib/site-language";
import { isInstalled } from "@/lib/install/guard";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  if (!(await isInstalled())) {
    return { title: "ENVORAICMS — Kurulum" };
  }
  const settings = await getSettings();
  return siteMetadata(settings);
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const isInstall = pathname.startsWith("/install") || pathname.startsWith("/api/install");

  const installed = await isInstalled();
  if (!installed && !isInstall) {
    redirect("/install");
  }
  if (!installed && isInstall) {
    return (
      <html lang="en" className={inter.variable}>
        <body className="font-sans antialiased">{children}</body>
      </html>
    );
  }

  if (isAdmin) {
    // The admin subtree provides its own shell; site chrome is skipped. Pull
    // the configured site language so the admin <html lang> matches the public
    // site for consistency.
    const adminLang = htmlLang((await getSettings()).SiteLanguage);
    return (
      <html lang={adminLang} className={inter.variable}>
        <body className="font-sans antialiased">{children}</body>
      </html>
    );
  }

  // Footer's link rows are fetched inside <Suspense> below — keeping them
  // out of this Promise.all lets the shell stream as soon as the
  // shell-critical queries (settings/categories/theme) settle.
  const [settings, categories, preference, themeSlug] = await Promise.all([
    getSettings(),
    getHeaderCategories(),
    readColorPreference(),
    getActiveThemeSlug(),
  ]);

  const gaId = settings.GoogleAnalyticsID;
  const gtmId = settings.GoogleTagManagerID;
  const adsensePub = settings.AdsensePublisherID;
  const adsenseAuto = settings.AdsenseAutoAds;
  const toggleAllowed = settings.AllowColorToggle !== false;
  const effectivePreference = toggleAllowed ? preference : null;
  const colorMode = resolveColorMode(effectivePreference, settings.DefaultColorMode);

  return (
    <html lang={htmlLang(settings.SiteLanguage)} className={inter.variable} data-theme={colorMode} data-site-theme={themeSlug}>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: brandColorsCss(settings.PrimaryColor, settings.SecondaryColor),
          }}
        />
        {settings.SearchConsoleMeta ? (
          <meta name="google-site-verification" content={settings.SearchConsoleMeta} />
        ) : null}
        {settings.BingVerification ? (
          <meta name="msvalidate.01" content={settings.BingVerification} />
        ) : null}
        {gtmId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
            }}
          />
        ) : null}
        {gaId ? (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
              }}
            />
          </>
        ) : null}
        {adsensePub ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsensePub}`}
            crossOrigin="anonymous"
          />
        ) : null}
        {adsensePub && adsenseAuto ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(adsbygoogle=window.adsbygoogle||[]).push({google_ad_client:'${adsensePub}',enable_page_level_ads:true});`,
            }}
          />
        ) : null}
        {settings.AdsenseExtraHead ? (
          <div dangerouslySetInnerHTML={{ __html: settings.AdsenseExtraHead }} />
        ) : null}
      </head>
      <body className="font-sans antialiased">
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        ) : null}
        <Header
          settings={settings}
          colorMode={colorMode}
          showToggle={toggleAllowed}
          topCategories={
            settings.ShowHeaderMenu !== false
              ? categories.filter((c) => c.HeaderMenu).slice(0, 5)
              : []
          }
          allCategories={categories}
          showHeaderMenu={settings.ShowHeaderMenu !== false}
        />
        {settings.ShowHeaderMenu !== false ? <Nav categories={categories} /> : null}
        <main className="mx-auto w-full max-w-container px-4 py-6 md:py-8">{children}</main>
        <Suspense fallback={<div className="mt-16 h-64 border-t border-neutral-200 bg-navy" />}>
          <FooterStream settings={settings} categories={categories} />
        </Suspense>
        <JsonLd data={websiteJsonLd(settings)} />
        <JsonLd data={organizationJsonLd(settings)} />
        {settings.HeaderScripts ? (
          <div dangerouslySetInnerHTML={{ __html: settings.HeaderScripts }} />
        ) : null}
      </body>
    </html>
  );
}
