import { Link, useLocation } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { SECTION_BANNER } from "./sectionBanners";

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
 *
 * The background photo is picked automatically from `eyebrow` — no need to
 * pass it explicitly from every page. A navy/teal gradient sits on top so
 * text stays legible regardless of the photo underneath.
 */
export function SectionHero({ eyebrow, title, description, links }: SectionHeroProps) {
  const location = useLocation();
  const photo = SECTION_BANNER[eyebrow];

  return (
    <div className="relative overflow-hidden">
      {photo && (
        <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 hero-gradient opacity-90" />
      <div className="relative p-6 lg:p-8">
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