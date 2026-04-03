export const appName = 'typed-fetch';
export const appDescription =
  'Status-aware fetch wrapper that learns API response shapes and generates TypeScript types from real traffic.';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const siteName = `${appName} Docs`;

function normalizeSiteUrl(value?: string) {
  if (!value) return 'http://localhost:3000';

  const withProtocol = value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`;

  try {
    return new URL(withProtocol).toString().replace(/\/$/, '');
  } catch {
    return 'http://localhost:3000';
  }
}

export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL);

export const gitConfig = {
  user: 'PhumudzoSly',
  repo: 'typed-fetch',
  branch: 'main',
};
