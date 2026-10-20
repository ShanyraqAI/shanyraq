import { headers } from "next/headers";
import { getSiteUrl } from "@/lib/site-url";
import { landingFaqs } from "./landing-sections";

export async function LandingStructuredData() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const siteUrl = getSiteUrl().origin;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Shanyraq AI",
        url: siteUrl,
        logo: `${siteUrl}/brand/shanyraq-logo.png`,
        email: "hello@shanyraq.ai",
        areaServed: { "@type": "Country", name: "Kazakhstan" },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Shanyraq AI",
        url: siteUrl,
        inLanguage: "ru-KZ",
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: "Shanyraq AI",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        url: siteUrl,
        description: "Программа для посуточной аренды в Казахстане: квартиры, дома и апарт-отели.",
        inLanguage: "ru-KZ",
        offers: { "@type": "Offer", price: "0", priceCurrency: "KZT", description: "Бесплатно на время бета-теста" },
        publisher: { "@id": `${siteUrl}/#organization` },
      },
      {
        "@type": "FAQPage",
        mainEntity: landingFaqs.map(([question, answer]) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // Escape "<" so content can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
