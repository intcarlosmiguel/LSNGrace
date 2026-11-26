import { Icon } from '../../components/Icon';
export function ExamplePicker({
  onChoose,
  onClose,
}: {
  onChoose: (multiple: boolean) => void;
  onClose: () => void;
}) {
  return (
    <section className="example-picker" aria-label="Criar exemplo">
      <header className="editor-heading">
        <div>
          <span className="eyebrow">EXEMPLOS</span>
          <h2>Escolha a imagem de exemplo</h2>
          <p>Todos os gráficos, séries e dados podem ser editados.</p>
        </div>
        <button className="icon-button" aria-label="Fechar exemplos" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      <div className="example-options">
        <button className="example-card" onClick={() => onChoose(false)}>
          <img
            src="/examples/um-grafico.png"
            alt="Prévia de uma imagem com um gráfico de relaxação"
          />
          <strong>Imagem com um gráfico</strong>
          <span>Modelo exponencial e medições com barras de erro.</span>
        </button>
        <button className="example-card" onClick={() => onChoose(true)}>
          <img
            src="/examples/multiplos-graficos.png"
            alt="Prévia de dois gráficos lado a lado e um gráfico interno"
          />
          <strong>Imagem com vários gráficos</strong>
          <span>Dois gráficos lado a lado e um gráfico interno.</span>
        </button>
      </div>
      <p className="example-note">
        Dados sintéticos. Você pode desfazer a criação para recuperar a imagem anterior.
      </p>
    </section>
  );
}
