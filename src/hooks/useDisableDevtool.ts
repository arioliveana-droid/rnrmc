/**
 * useDisableDevtool
 * Hook que ativa o disable-devtool apenas no client-side (não SSR).
 * Redireciona para /bloqueado quando DevTools é detectado.
 *
 * Uso: chame esse hook no RootComponent ou em qualquer layout pai.
 */
import { useEffect } from "react";

// Configuração global — edite aqui para ajustar comportamento
const CONFIG = {
  /** URL para redirecionar quando DevTools for detectado */
  redirectUrl: "/bloqueado",
  /** Desabilita F12 */
  disableF12: true,
  /** Desabilita clique direito */
  disableMenu: true,
  /** Desabilita Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+U */
  disableShortcutKeys: true,
  /** Intervalo de detecção em ms */
  interval: 500,
  /** Limpa o console automaticamente */
  clearLog: true,
  /** Se true, funciona em modo de detecção severa */
  detectorWorker: true,
} as const;

export function useDisableDevtool({ disabled = false }: { disabled?: boolean } = {}) {
  useEffect(() => {
    // Não ativa na página de bloqueio nem no SSR
    if (disabled || typeof window === "undefined") return;

    let destroyed = false;

    // Importação dinâmica para não quebrar no SSR
    import("disable-devtool")
      .then(({ default: DisableDevtool }) => {
        if (destroyed) return;
        DisableDevtool({
          url: CONFIG.redirectUrl,
          disableMenu: CONFIG.disableMenu,
          disableShortcutKeys: CONFIG.disableShortcutKeys,
          interval: CONFIG.interval,
          clearLog: CONFIG.clearLog,
          detectorWorker: CONFIG.detectorWorker,
        });
      })
      .catch((err) => {
        // Silencia erros de carregamento — não deve quebrar o site
        console.warn("[security] disable-devtool não pôde ser carregado:", err);
      });

    return () => {
      destroyed = true;
    };
  }, [disabled]); // Re-roda se mudar de rota
}
