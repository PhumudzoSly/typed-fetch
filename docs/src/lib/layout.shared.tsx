import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontWeight: 600, fontSize: '1.125rem' }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6d28d9" />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="15" fill="url(#logoGrad)" opacity="1"/>
            <rect x="6" y="8" width="3.5" height="14" fill="white" rx="0.5"/>
            <rect x="6" y="8" width="7" height="2.5" fill="white" rx="0.5"/>
            <line x1="16.5" y1="16" x2="24.5" y2="16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <polyline points="22,13.5 24.5,16 22,18.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          <span style={{ 
            backgroundImage: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent', 
            backgroundClip: 'text' 
          }}>
            {appName}
          </span>
        </div>
      ),
    },
    links: [
      {
        text: 'Documentation',
        url: '/docs',
        active: 'nested-url',
      },
      {
        text: 'Examples',
        url: '/docs/examples-react',
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
