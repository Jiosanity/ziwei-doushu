'use client';
import { usePathname } from 'next/navigation';
import SiteHeader from './SiteHeader';

export default function InnerSiteFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === '/' || path === '/chart') return children;
  return <><SiteHeader compact /><div className="inner-site-content">{children}</div></>;
}
