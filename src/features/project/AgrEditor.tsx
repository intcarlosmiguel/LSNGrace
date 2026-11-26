import { useState } from 'react';
import type { Scene } from '../../core/scene/types';
import { serializeAgr } from '../../core/agr/serializer';
import { parseAgr } from '../../core/agr/parser';
import { requestGrace } from '../../rendering/native/client';
import { Icon } from '../../components/Icon';
export function AgrEditor({
  scene,
  onApply,
  onClose,
}: {
  scene: Scene;
  onApply: (scene: Scene) => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState(() => {
      try {
        return serializeAgr(scene);
      } catch {
        return '';
      }
    }),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const parsed = parseAgr(source);
      if (!parsed.graphs.length) throw Error('O projeto precisa ter pelo menos um gráfico.');
      await requestGrace(parsed);
      onApply(parsed);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="data-editor agr-editor" aria-label="Editor de parâmetros AGR">
      <header className="editor-heading">
        <div>
          <span className="eyebrow">FORMATO NATIVO DO GRACE</span>
          <h2>Parâmetros do projeto</h2>
          <p>
            Edite os parâmetros AGR. O Grace original valida o projeto antes de aplicar as
            alterações.
          </p>
        </div>
        <button className="icon-button" aria-label="Fechar parâmetros AGR" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <label className="agr-source">
        <span>Projeto .agr</span>
        <textarea
          aria-label="Código AGR"
          spellCheck={false}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
      </label>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <footer className="editor-footer">
        <span>
          Dados, estilos e parâmetros permanecem editáveis. Desfazer recupera o projeto anterior.
        </span>
        <div>
          <button className="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy} onClick={() => void apply()}>
            {busy ? 'Validando no Grace…' : 'Aplicar no Grace'}
          </button>
        </div>
      </footer>
    </section>
  );
}
