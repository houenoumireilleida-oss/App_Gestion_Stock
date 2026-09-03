import { Link, useLocation } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export type SectionHeroLink = {
  to: string;
  label: string;
  icon?: LucideIcon;
};

type SectionHeroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  links?: SectionHeroLink[];
};

/**
 * Banner used at the top of each section's landing page (Vente, Facturation,
 * Stock, Achats, Admin…). Replaces the old second header row: the section's
 * sub-pages are now reachable as pills inside this banner instead.
 */
export function SectionHero({ eyebrow, title, description, links }: SectionHeroProps) {
  const location = useLocation();

  return (
    <div className="relative overflow-hidden hero-gradient hero-pattern">
      <div className="relative p-6 lg:p-8 max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-2">
          {eyebrow}
        </p>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        {description && (
          <p className="text-white/70 mt-1.5 max-w-2xl text-sm">{description}</p>
        )}

        {links && links.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {links.map(l => {
              const active = location.pathname === l.to ||
                (l.to !== "/dashboard" && location.pathname.startsWith(l.to + "/"));
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`nav-pill ${active ? "nav-pill-active" : "nav-pill-inactive-dark"}`}
                >
                  {l.icon && <l.icon className="size-3.5" />}
                  {l.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
