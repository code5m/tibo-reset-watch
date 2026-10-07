import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { nav, site } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "ResetWatch｜Codex / ChatGPT Work Reset 北京时间提醒",
    template: "%s｜ResetWatch"
  },
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: site.url,
    title: "ResetWatch｜不错过下一次 Codex Reset",
    description: site.description,
    siteName: site.name
  },
  twitter: {
    card: "summary_large_image",
    title: "ResetWatch",
    description: site.description
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1
    }
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark"
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  description: site.description,
  sameAs: [site.github]
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.productName,
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  url: site.url,
  description: site.description,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "CNY"
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        <header className="site-header">
          <div className="shell nav-shell">
            <Link className="brand" href="/" aria-label="ResetWatch 首页">
              <span className="brand-mark">R</span>
              <span>ResetWatch</span>
            </Link>
            <nav className="nav-links" aria-label="主导航">
              {nav.map(item => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <Link className="button button-small" href="/subscribe">
              免费订阅
            </Link>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="shell footer-grid">
            <div>
              <div className="brand footer-brand">
                <span className="brand-mark">R</span>
                <span>ResetWatch</span>
              </div>
              <p>把 AI 使用额度的“什么时候重置”，变成一个可以行动的北京时间提醒。</p>
            </div>
            <div className="footer-links">
              <Link href="/about">关于</Link>
              <Link href="/faq">FAQ</Link>
              <Link href="/status">系统状态</Link>
              <Link href="/privacy">隐私</Link>
              <a href={site.github} target="_blank" rel="noreferrer">GitHub</a>
            </div>
          </div>
          <div className="shell legal">
            © {new Date().getFullYear()} ResetWatch · 非 OpenAI 官方产品
          </div>
        </footer>
      </body>
    </html>
  );
}
