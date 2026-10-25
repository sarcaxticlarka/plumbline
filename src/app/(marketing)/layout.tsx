import { LandingProviders } from "@/components/landing/Providers";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <LandingProviders>{children}</LandingProviders>;
}
