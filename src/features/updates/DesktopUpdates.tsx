import { useEffect, useState } from 'react';
import { useDocument } from '../../state/document';
import { DRAFT_KEY, serializeDraft } from '../../state/draft';
type UpdateState = {
  phase: string;
  version?: string;
  percent?: number;
  message?: string;
};
declare global {
  interface Window {
    desktopUpdates?: {
      status(): Promise<UpdateState>;
      check(): Promise<void>;
      download(): Promise<void>;
      install(): Promise<void>;
      subscribe(listener: (state: UpdateState) => void): () => void;
    };
  }
}
export function DesktopUpdates() {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' });
  const api = window.desktopUpdates;
  useEffect(() => {
    if (!api) return;
    let active = true;
    const unsubscribe = api.subscribe(setState);
    void api.status().then((value) => {
      if (active) setState(value);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [api]);
  if (!api) return null;
  const invoke = async (operation: () => Promise<void>) => {
    try {
      await operation();
    } catch (error) {
      setState({ phase: 'error', message: String(error) });
    }
  };
  const install = () =>
    invoke(async () => {
      const { scene, name } = useDocument.getState();
      // Flush the current figure synchronously before the application is restarted.
      localStorage.setItem(DRAFT_KEY, serializeDraft(scene, name));
      await api.install();
    });
  return (
    <aside className="desktop-updates" aria-label="Atualizações do aplicativo">
      <span role="status">
        {state.phase === 'available'
          ? `Versão ${state.version} disponível`
          : state.phase === 'ready'
            ? `Versão ${state.version} pronta para instalar`
            : state.phase === 'downloading'
              ? `Baixando atualização: ${Math.round(state.percent ?? 0)}%`
              : state.phase === 'checking'
                ? 'Buscando atualizações…'
                : state.phase === 'current'
                  ? 'Aplicativo atualizado'
                  : state.phase === 'error'
                    ? 'Não foi possível atualizar'
                    : state.phase === 'disabled'
                      ? state.message
                      : 'LSNGrace'}
      </span>
      {state.phase === 'error' && (
        <span title={state.message}> — Verifique a conexão e a publicação no GitHub.</span>
      )}
      {state.phase === 'available' ? (
        <button onClick={() => void invoke(() => api.download())}>Atualizar</button>
      ) : state.phase === 'ready' ? (
        <button onClick={() => void install()}>Reiniciar e instalar</button>
      ) : (
        <button
          disabled={['checking', 'downloading', 'disabled'].includes(state.phase)}
          onClick={() => void invoke(() => api.check())}
        >
          Buscar atualização
        </button>
      )}
    </aside>
  );
}
