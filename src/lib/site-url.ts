// Public origin for canonical URLs, sitemap and Open Graph. Set SITE_URL once the
// custom domain is connected; on Vercel the production domain is used automatically.
export function getSiteUrl(): URL {
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const raw =
    process.env.SITE_URL ||
    process.env.APP_URL ||
    (vercelProduction ? `https://${vercelProduction}` : "http://localhost:3000");
  return new URL(raw);
}

export function isIndexableDeployment(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  return !vercelEnv || vercelEnv === "production";
}
