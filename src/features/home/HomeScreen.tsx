import { Icon } from '../../components/Icon';
import type { RecentFigure } from '../../state/recent';
export function HomeScreen({
  figures,
  onNew,
  onOpen,
  onResume,
  onChoose,
  onDelete,
}: {
  figures: RecentFigure[];
  onNew: () => void;
  onOpen: () => void;
  onResume: () => void;
  onChoose: (figure: RecentFigure) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <main className="home-screen">
      <div className="home-heading">
        <span className="eyebrow">SEU ESPAÇO DE FIGURAS CIENTÍFICAS</span>
        <h1>Da simulação à publicação.</h1>
        <p>Crie gráficos, abra projetos Grace e continue suas imagens recentes.</p>
      </div>
      <div className="home-actions">
        <button onClick={onNew}>
          <Icon name="plus" size={28} />
          <strong>Criar novo gráfico</strong>
          <span>Comece com uma tabela ou seus dados.</span>
        </button>
        <button onClick={onOpen}>
          <Icon name="upload" size={28} />
          <strong>Carregar imagem / projeto</strong>
          <span>Projetos AGR e PAR · dados CSV, TSV, DAT e TXT</span>
        </button>
        <button onClick={onResume}>
          <Icon name="undo" size={28} />
          <strong>Continuar rascunho</strong>
          <span>Volte à imagem atual no editor.</span>
        </button>
      </div>
      <div className="home-history-heading">
        <h2>Histórico das imagens</h2>
        <span>Salvo neste navegador · clique para reabrir</span>
      </div>
      {figures.length ? (
        <div className="recent-grid">
          {figures.map((figure) => (
            <article className="recent-card" key={figure.id}>
              <button
                className="recent-open"
                onClick={() => onChoose(figure)}
                aria-label={`Abrir ${figure.name}`}
              >
                <div className="recent-preview">
                  {figure.thumbnail ? (
                    <img src={figure.thumbnail} alt={`Prévia de ${figure.name}`} />
                  ) : (
                    <Icon name="chart" size={48} />
                  )}
                </div>
                <strong>{figure.name.replace(/\.agr$/i, '')}</strong>
                <span>
                  {new Date(figure.updated).toLocaleString('pt-BR')} · {figure.scene.graphs.length}{' '}
                  gráfico(s)
                </span>
              </button>
              <button
                className="icon-button recent-delete"
                aria-label={`Remover ${figure.name} do histórico`}
                title="Remover do histórico"
                onClick={() => onDelete(figure.id)}
              >
                <Icon name="trash" size={16} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="home-empty">Suas imagens aparecerão aqui ao criar ou abrir um gráfico.</p>
      )}
    </main>
  );
}
