import dashboardPhoto from "../assets/banners/hero-dashboard.jpg";
import ventePhoto from "../assets/banners/banner-vente.jpg";
import facturationPhoto from "../assets/banners/banner-caisse.jpg";
import stockPhoto from "../assets/banners/banner-entrepot.jpg";
import financesPhoto from "../assets/banners/banner-finances.jpg";
import achatsPhoto from "../assets/banners/banner-stock.jpg";
import clientsPhoto from "../assets/banners/banner-equipe.jpg";
import adminPhoto from "../assets/banners/banner-approbation.jpg";

/** Maps each section's `eyebrow` label to its real background photo.
 *  "Aide" has no entry on purpose — it keeps its plain gradient. */
export const SECTION_BANNER: Record<string, string> = {
  "Tableau de bord": dashboardPhoto,
  Vente: ventePhoto,
  Facturation: facturationPhoto,
  Stock: stockPhoto,
  Finances: financesPhoto,
  Achats: achatsPhoto,
  Clients: clientsPhoto,
  Admin: adminPhoto,
};