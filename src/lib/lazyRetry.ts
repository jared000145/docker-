import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk-reload-ts";

/**
 * React.lazy avec reprise automatique : si un chunk n'est plus disponible
 * (nouveau déploiement => anciens fichiers hashés supprimés), on recharge
 * la page une seule fois pour récupérer le nouveau manifeste.
 */
export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (error) {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      // Un seul rechargement par minute pour éviter toute boucle infinie
      if (Date.now() - last > 60_000) {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
        window.location.reload();
        // Empêche React d'afficher l'erreur pendant le rechargement
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}
