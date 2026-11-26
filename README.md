# LSNGrace

Ambiente de gráficos científicos inspirado no xmgrace. A aplicação permite criar figuras com dados próprios, importar tabelas e projetos Grace, ajustar eixos e séries e exportar o resultado. O núcleo do Marco 1 está acompanhado das primeiras entregas de UX e ingestão tabular.

## Executar

No Linux, execute `./LSNGrace` ou abra o atalho **LSNGrace.desktop** nesta pasta (se o gerenciador de arquivos solicitar, permita sua execução). O iniciador compila a aplicação, inicia o servidor local e abre uma janela própria no Chrome/Chromium; em outros navegadores, abre uma aba. Abrir novamente reutiliza o servidor ativo. Fechar a janela mantém o servidor disponível.

O iniciador requer Node.js 24+, npm e Grace (`gracebat`). Instala as dependências com `npm ci` quando necessário. Use `./LSNGrace --no-open` para iniciar sem abrir uma janela. O log fica em `.lsngrace/server.log`, e o PID em `.lsngrace/server.pid`. O atalho aponta para `/home/miguel/Downloads/grace`; ajuste seus campos `Exec` e `Path` se mover o projeto.

Requisitos: Node.js 24 LTS, npm e **Grace (`gracebat`) no PATH**. Esta versão usa o programa original instalado para desenhar e salvar as figuras.

```bash
npm ci
npm run dev
```

Abra <http://127.0.0.1:1420>. O LSNGrace inicia com um gráfico vazio ou recupera o último rascunho válido salvo neste navegador.

## Interface focada no gráfico

A organização segue a referência do [Desmos](https://www.desmos.com/calculator): cabeçalho baixo, lateral recolhível e controles compactos. A lateral mostra a hierarquia **Imagem → Gráficos → Séries** e mantém essa árvore visível durante a edição das propriedades.

- **Imagem** abre as dimensões de publicação, a orientação, a cor de fundo e a composição dos gráficos.
- Cada **Gráfico** abre sua posição e tamanho na imagem, títulos, eixos, escalas, borda, grades e legenda. O olho alterna sua visibilidade.
- Cada **Série** abre seu estilo. **Adicionar dados a G…** direciona os dados ao gráfico correspondente.
- **+ Gráfico** cria um painel ao lado; **Interno** cria um gráfico dentro do selecionado. Nas propriedades da imagem, use **Lado a lado**, **Empilhados** ou **Grade** para organizar a composição.
- Posição e dimensões dos gráficos são editáveis em pt, px, cm, mm, polegadas ou percentuais da imagem. Gráficos internos e legendas em coordenadas de página acompanham a mudança do gráfico que os contém.
- O canto superior direito reúne as ferramentas em **quatro linhas e duas colunas**, com botões de 44 px e ícones maiores: seleção, mão, zoom por área, configurações do gráfico, ampliar, afastar, **AS** (autoscale) e configurações da imagem.
- O menu superior esquerdo guarda **Nova imagem**, Importar, AGR, tema, compatibilidade e o enquadramento da página. **Exportar** reúne AGR, SVG, PNG e EPS.

Uma composição com vários gráficos sempre mostra a imagem inteira. Para um único gráfico, a câmera pode reduzir as margens vazias; selecionar **Imagem** mostra a página completa. O enquadramento na tela não altera a publicação nem os dados. Projetos com anotações preservadas também mantêm a página completa.

A relação “dentro de” é calculada pela área de plotagem: um gráfico totalmente contido em outro aparece como seu filho na árvore. Assim, o mesmo arquivo `.agr` continua sendo o modelo da composição, sem exigir um formato separado de hierarquia. Ao mover o gráfico interno para fora, ele passa a aparecer como gráfico independente. Remover um gráfico mantém os demais e pode ser desfeito.

## Criar seu gráfico

1. Clique em **Adicionar dados a G0** na hierarquia. Para um projeto vazio, use **Nova imagem** no menu do projeto.
2. Cole uma tabela do Excel, digite os valores ou use **Importar arquivo** para CSV, TSV, DAT ou TXT.
3. Selecione as colunas **X**, **Y** e, opcionalmente, **Erro em Y (±)**.
4. Dê um nome à série e clique em **Criar curva**. Os limites dos eixos incluem os dados e as incertezas automaticamente.
5. Selecione o **Gráfico** na lateral para editar posição, título, rótulos e eixos. Selecione uma **Série** para alterar o estilo ou usar **Editar dados**.
6. No menu **Exportar**, escolha **Projeto Grace (.agr)** ou **PDF, SVG, PNG ou EPS**. As saídas são produzidas pelo Grace original; os downloads não sobrescrevem o arquivo de entrada.

Exemplo de tabela aceita (ponto e vírgula com vírgula decimal):

```text
Tempo (s);Amplitude;Erro
0;1,00;0,05
1;0,78;0,04
2;0,54;0,03
```

Delimitadores são detectados automaticamente e podem ser escolhidos no editor. Há suporte a cabeçalho, comentários em linhas `#`/`@`/`//`, aspas CSV e expoentes Fortran. Células vazias, números inválidos, colunas incompatíveis ou incertezas negativas mostram a linha/coluna do problema e impedem criar a curva. Não há suporte a células CSV com quebras de linha internas.

- **Adicionar dados a G…** acrescenta séries ao gráfico indicado, sem substituir as existentes.
- **Editar dados** atualiza uma série preservando seu estilo.
- **Importar arquivo**, no menu do projeto, ou arrastar um `.agr`/`.par` abre um projeto; tabelas passam pelo mapeador de colunas.
- **Ajustar eixos** ou `A` enquadra as séries visíveis. Escalas inválidas não são aplicadas.
- **Desfazer/Refazer** cobre inserção, edição, remoção e criação de um gráfico novo. Abrir outro projeto AGR substitui o documento e reinicia esse histórico.
- `Ctrl/Cmd+O`: importar; `Ctrl/Cmd+S`: exportar; `Ctrl/Cmd+Z`: desfazer; `Ctrl+Y` ou `Cmd+Shift+Z`: refazer. Dentro dos campos, o histórico de texto permanece nativo.
- O painel de compatibilidade separa erros, avisos de renderização e diretivas preservadas, agrupando os detalhes avançados.

Os dados são processados localmente. Dados confirmados e configurações são salvos como rascunho no armazenamento deste navegador, se disponível. O conteúdo ainda não aplicado do editor e o histórico de Undo/Redo não sobrevivem ao recarregamento. Use **Salvar .agr** para manter uma cópia independente do navegador.

## Motor original e edição interativa

A interface não usa mais o renderizador SVG de aproximação para a prévia. O documento é serializado em AGR e enviado ao processo **`gracebat` 5.1.25** instalado nesta máquina. O programa original produz a prévia: SVG em figuras menores e PNG a partir de 100 mil pontos visíveis, mantendo todos os pontos. As exportações usam a geometria produzida pelo Grace original. PDF vetorial e PNG usam o SVG final, incluindo LaTeX e transparência. PDF requer Python 3 e as bibliotecas Cairo/librsvg do sistema; não usa pacotes Python adicionais. O rodapé mostra a versão conectada; sem o motor local, a aplicação informa a indisponibilidade e não substitui o resultado por uma imitação.

- Clique em uma curva ou ponto para selecionar a série.
- Duplo clique nos eixos ou título leva à propriedade correspondente no inspetor.
- Scroll sobre a área do gráfico amplia/reduz os limites.
- **Zoom por área** e **Mover gráfico** alteram as coordenadas world.
- Arraste a legenda nos modos seleção ou mão. Guias inteligentes alinham suas bordas e centro à área do gráfico e à página; segure `Alt` para posicionar livremente. Cada arraste é uma operação de Undo/Redo.
- A mão acompanha o cursor durante o movimento, e o zoom reutiliza a legenda e os textos vetoriais nativos.
- Ao criar a primeira curva, seu nome preenche o título vazio. Passe o mouse sobre o título e use **Configurar** para editar. Títulos existentes são preservados.
- Arraste os marcadores nos cantos do viewport para redimensioná-lo.
- A opção **Parâmetros AGR** no menu permite editar parâmetros nativos e validá-los no Grace antes de aplicar.
- O inspetor oferece os símbolos 0–11 e os estilos de conexão do Grace.
- A opção **Modo claro/escuro** no menu do projeto troca e memoriza o tema da interface. A página de publicação mantém suas cores, tanto na prévia como na exportação.

As interações geométricas implementadas são para gráficos XY. Outros tipos podem ser renderizados pelo motor, mas ainda não têm todas as interações e propriedades expostas na interface. Transformações, regressão e o conjunto completo de ferramentas do xmgrace continuam previstos no plano de desenvolvimento.

O serviço nativo acompanha `npm run dev` e `npm run preview`. Hospedar apenas o diretório `dist` como site estático não executa o Grace. O shell Tauri de desenvolvimento pode usar esse serviço; o empacotamento desktop autônomo ainda precisa de uma ponte Rust/sidecar e não foi compilado neste ambiente.

Avisos de conteúdo fora da página são exibidos sem bloquear a prévia ou as exportações válidas. O aviso permite conferir a página e suas propriedades; ele não reposiciona elementos automaticamente. Erros de sintaxe e falhas reais continuam sendo bloqueados.

A ponte usa processos com timeout, arquivos temporários exclusivos e modo `-safe`. Ela aceita parâmetros declarativos AGR, não scripts arbitrários de I/O. O limite atual é 16 MB por projeto e 4096 pt por dimensão de página. Símbolos e textos clássicos são processados pelo interpretador original. Expressões LaTeX entre `$...$`, `$$...$$`, `\(...\)` ou `\[...\]` são compostas localmente como vetores pelo MathJax em títulos, subtítulos, nomes dos eixos e legendas. SVG e PNG mantêm essa composição; AGR preserva o texto original em metadados e fornece uma tradução clássica para o xmgrace. EPS utiliza essa tradução e mostra um aviso de simplificação.

## Verificação

```bash
npm test
npm run build
npm run test:grace
npm run test:native
npm run format:check
```

`test:grace` requer `gracebat` no PATH. Abre os arquivos exportados no Grace real, salva novamente, compara dados e propriedades modeladas e exige exportação SVG sem mensagens de erro. A versão instalada e utilizada nesta entrega é **Grace 5.1.25**. Os arquivos do LSNGrace usam o cabeçalho solicitado `50122`; compatibilidade com um binário 5.1.22 ainda não foi executada.

Os testes unitários cobrem round-trip de fixtures geradas pelo Grace, dados inválidos, precisão, textos escapados, IDs esparsos, preservação de diretivas, transformações de coordenadas, ticks, SVG e histórico. A comparação de dados após salvamento pelo Grace admite tolerância relativa de `1e-7`, pois o Grace usa seu próprio formato numérico de saída.

## Estrutura

```text
src/
  core/
    scene/         Schema TypeScript, defaults, validação
    agr/           Tabela de diretivas, parser e serializador
    geometry/      World, viewport, escalas, ticks e autoscale
    import/        Parser e mapeamento tabular
  rendering/native/ Cliente e sincronização com o Grace original
  rendering/svg/    Renderizador anterior, mantido para referência/testes
  components/      Ícones vetoriais e controles compartilhados
  features/        Editor de dados e inspetor
  state/           Documento, histórico Zustand e rascunho local
  app/             Interface React e estilos Tailwind/CSS
server/            Ponte local para o processo gracebat
src-tauri/         Estrutura do shell Tauri v2
scripts/           Validação pelo Grace original
tests/            Testes e fixtures reproduzíveis
docs/             Arquitetura, plano e matriz de compatibilidade
```

Veja [o schema](src/core/scene/types.ts), [a arquitetura](docs/architecture/scene-graph.md), [o plano de desenvolvimento](docs/PLAN.md) e [a matriz de compatibilidade](docs/compatibility/MATRIX.md).

## Desktop

A estrutura Tauri v2 foi criada, com a mesma aplicação web e sem lógica de parsing duplicada em Rust. Com o toolchain Rust e os pré-requisitos Tauri do sistema operacional instalados:

```bash
npm run tauri -- dev
```

**O desktop não foi compilado nesta entrega**, pois `rustc`/Cargo não estão disponíveis no ambiente. A janela foi configurada para permitir o drag-and-drop HTML. Bundles/instaladores estão desabilitados até a etapa de distribuição. I/O nativo e watchers serão implementados no Marco 3.

## Limites desta versão

O motor é o Grace original; a interface moderna ainda não expõe todas as ferramentas do xmgrace. O modelo interpreta diretamente um subconjunto de AGR e encaminha outras diretivas declarativas preservadas ao motor, incluindo anotações e opções avançadas. A preservação textual ainda não é uma AST completa do interpretador e pode alterar a ordem relativa de comandos.

O driver SVG nativo referencia fontes por nome; a tipografia exibida depende das fontes instaladas no navegador. PNG e EPS são produzidos pelos respectivos drivers nativos. Não há PDF neste build do Grace e o seletor de DPI ainda não foi implementado.

O Grace trabalha com Latin-1. A ponte preserva acentos e traduz letras gregas comuns para escapes Symbol; caracteres não representáveis geram erro. A abertura detecta UTF-8, UTF-16 e Latin-1. A exportação AGR nativa usa `%.17g`; diferenças de até quatro epsilons de máquina foram verificadas na conversão numérica do interpretador nativo, sem promessa de igualdade binária entre parsers.

Importadores XLSX/Parquet/HDF5/JSON/NumPy, hot-links, análise matemática, regressão e LaTeX moderno permanecem pendentes. O renderer anterior é mantido nos testes, mas não é usado silenciosamente no lugar do motor original.

## Referência

A convenção de coordenadas segue o [manual oficial do Grace](https://plasmagate.weizmann.ac.il/Grace/doc/UsersGuide.html): uma unidade de viewport corresponde à **menor dimensão da página**, com origem no canto inferior esquerdo. Em Letter horizontal, o viewport padrão nativo vai de `(0.15, 0.15)` a `(1.15, 0.85)`.

### Desempenho

A edição e o histórico compartilham dados imutáveis, e as prévias e blocos numéricos são reutilizados. A prévia de séries densas evita milhares de elementos DOM; a exportação vetorial continua disponível com os dados completos. Execute `npm run benchmark` para medir 208, 10 mil e 100 mil pontos no ambiente local. Consulte o [relatório de desempenho](docs/compatibility/performance.md) para os resultados e limites das medições.

### Zoom e cores

O zoom tem uma prévia imediata durante o gesto, seguida do desenho definitivo do Grace. Em **Estilo da série**, use as amostras da paleta ou **Personalizado…** para RGB/hexadecimal. O preenchimento dos símbolos tem cor própria, além de alpha independente da série. SVG/PNG preservam transparência real; o AGR guarda alpha para reabrir no LSNGrace, enquanto o Grace clássico mostra cores opacas. EPS compõe as cores no fundo. Consulte a [validação de zoom e aparência](docs/compatibility/zoom-colors.md).

### Edição no canvas

Passe o mouse sobre títulos, curvas, legenda, eixos ou nomes dos eixos e use **Configurar**. Nas curvas, **Dados** abre a tabela da série. Clique nos textos para editar no painel contextual; arrastar a legenda continua disponível. O botão direito abre os ajustes do gráfico: borda, eixos, escalas, grades, inversão e ajuste automático. **Shift+F10** também abre o menu; **Esc** o fecha. Alterações participam de Desfazer/Refazer e do arquivo AGR. Veja a [validação dos controles contextuais](docs/compatibility/contextual-controls.md).

## Exemplo com vários gráficos

No menu do projeto, escolha **Criar exemplo → Imagem com vários gráficos**. O seletor também oferece **Imagem com um gráfico** e aparece na tela inicial vazia. A imagem tem dois painéis lado a lado (relaxação com barras de erro e oscilação amortecida) e um gráfico interno com o detalhe inicial da relaxação. Os dados são sintéticos e determinísticos. Carregar o exemplo pode ser desfeito.

O projeto também está disponível em [examples/multiplos-graficos.agr](examples/multiplos-graficos.agr), com prévias PNG e SVG na mesma pasta. O gerador está em `src/core/examples/composition.ts`.

## Unidades, fontes e redimensionamento

Os campos de fonte aceitam valores não negativos sem teto artificial de tamanho. Use o seletor ao lado do campo para escolher **pt, px, cm, mm, in, % ou Grace (×)**. Trocar a unidade muda a leitura, preservando o tamanho. Pixels são pixels de referência a 96 px por polegada; não dependem do zoom da tela nem do DPI de exportação.

- Fontes: **100%** equivale ao tamanho padrão do Grace. O documento mantém a escala nativa do Grace; em pontos, 1× corresponde a 2,8% do menor lado da página.
- Imagem: **100%** corresponde às dimensões existentes ao selecionar a unidade %, informadas abaixo do seletor. A opção de manter proporção altera os dois lados em conjunto.
- Gráficos: **%** usa a largura e a altura da imagem como referência. As outras unidades medem a área física de publicação.

Em **Posição na imagem**, **Aumentar/Reduzir** muda a área do gráfico em torno do centro. Os botões **+/−** do canvas fazem zoom nos dados. O redimensionamento por cantos acompanha o deslocamento exato do cursor, mostra o contorno e as dimensões propostas e confirma uma operação no histórico ao soltar. A imagem permanece enquadrada na página durante a edição, evitando que o enquadramento compense visualmente o aumento.

**Manter proporção do gráfico** vale tanto para os campos quanto para o arraste. **Shift** também mantém a proporção; **Alt** redimensiona pelo centro. **Escape** cancela o gesto. Os gráficos internos e as legendas view acompanham a alteração; dados e limites world permanecem iguais ao redimensionar a área.

O redimensionamento também tem **guias inteligentes**: bordas e centros encaixam nas referências da imagem e dos outros gráficos dentro de 6 pixels de tela. O encaixe respeita a âncora e a proporção. Gráficos internos que acompanham o gráfico selecionado não são usados como referência. Segure **Ctrl/Cmd** durante o arraste para posicionar livremente. Os botões **Aumentar/Reduzir** usam as mesmas referências e mostram os alinhamentos por um breve período após o clique.

## Edição automática e eixos

Campos numéricos aplicam valores válidos automaticamente após 180 ms sem digitar, mantendo o foco e a escrita no campo. Enter é opcional. Valores incompletos ou incompatíveis ficam sinalizados no campo sem substituir a última figura válida; sair do campo inválido recupera o valor aceito. Alterações aceitas na mesma sessão de edição do campo formam um único passo de Desfazer.

Selecione um eixo no canvas para abrir seus controles na lateral, organizados em grupos expansíveis:

- **Escala e intervalo:** limites, escala linear/logarítmica/recíproca, inversão, espaçamento e subdivisões; visibilidade independente da barra, marcas e números.
- **Nome do eixo e barra:** texto, fonte, tamanho com unidades e cor do nome; cor, espessura e estilo da barra.
- **Números dos ticks:** formato geral/decimal/exponencial/científico/potência, precisão, ângulo, lado, fonte, tamanho, cor, prefixo/sufixo, omissão de rótulos e alternância em níveis.
- **Marcas e grades:** direção e lado das marcas, posições arredondadas, comprimento, cor, espessura e estilo dos ticks principais e menores, com grades principal e secundária.
- **Posicionamento:** eixo na origem e deslocamentos normal/oposto em coordenadas nativas do Grace.

Os parâmetros são enviados ao Grace original e preservados no AGR. Estilos avançados de eixo que não cabem na prévia rápida de navegação aguardam o desenho nativo.

## Mão com dois comportamentos

Selecione a mão e passe o mouse sobre o gráfico:

- **Dentro da área dos dados:** o contorno e a dica indicam **Mover dados dentro do gráfico**. Arrastar altera os limites world, mantendo a posição e o tamanho da moldura.
- **Na faixa superior, incluindo título e subtítulo:** o hover destaca essa faixa e indica **Mover gráfico na imagem**. Arrastar translada o gráfico inteiro, mantendo dados, escalas e limites. Títulos, nomes dos eixos, legenda e gráficos internos acompanham a posição.
- **Sobre a legenda:** a dica indica **Mover legenda** e o arraste continua independente.

O movimento da posição usa guias inteligentes para alinhar bordas e centros à imagem e aos outros gráficos visíveis, com tolerância de 6 pixels. **Ctrl/Cmd** permite mover livremente. A câmera permanece fixa na página enquanto a mão está selecionada; cada gesto é uma operação de Desfazer e Escape cancela o arraste. O SVG nativo não seleciona texto durante os gestos.

## Barras dos eixos, grade e legenda

Nas propriedades de cada eixo, **Mostrar barra** permite ocultar sua linha independentemente das marcas e dos números. A moldura externa continua tendo seu próprio controle **Mostrar borda**, nas propriedades do gráfico. A seção **Grade** tem grades principal e secundária com direção horizontal/vertical, estilo de linha, espessura, paleta/cor personalizada e alpha próprios, sem alterar a aparência dos ticks.

O Grace desenha barras e moldura sobrepostas. **Mostrar barra** considera essa sobreposição: desmarcar desativa a moldura e a barra selecionada em uma única edição, mantendo as barras do outro eixo. Projetos que usavam somente a moldura para o outro eixo recebem uma barra nativa com o mesmo estilo. Marcas, números, grade e dados são preservados; Desfazer restaura a configuração anterior. Reativar a barra desenha somente a barra, sem recriar a sobreposição.

Selecione a legenda no canvas para configurar distribuição vertical, horizontal ou em colunas, ordem inversa, tamanho dos ícones, comprimento das amostras e espaçamentos. Também é possível ajustar fonte, textos, fundo transparente ou semitransparente, cor e estilo da borda. Os campos são aplicados automaticamente.

SVG e PNG preservam a composição e a transparência completas. O AGR armazena essas extensões em comentários LSNGrace para reabertura no aplicativo; o Grace clássico ignora esses comentários e usa sua apresentação compatível. EPS usa a apresentação compatível, com aviso na exportação.

## Configurações de exportação

**Exportar** abre um painel com o tipo de arquivo (PNG, SVG ou EPS) e uma ação separada para salvar o projeto AGR. Para PNG, escolha 72, 96, 150, 300, 600 ou 1200 DPI, ou informe uma resolução personalizada. As dimensões em pixels são calculadas a partir do tamanho físico da imagem em pontos; o PNG registra a resolução no metadado padrão `pHYs`. A seleção é mantida ao reabrir o painel durante a sessão. SVG e EPS não usam DPI.

Valores inválidos bloqueiam a exportação com uma mensagem. O limite de rasterização é 144 milhões de pixels e 20.000 pixels por lado, sem redução silenciosa da resolução solicitada.

## Inserção com estilos e categorias

No editor de dados, **Aparência das curvas** permite ligar/desligar linha e símbolos separadamente, escolher o tracejado e o tipo de símbolo, e usar cores automáticas ou uma cor da paleta/personalizada antes de criar as curvas.

Em **Legenda por categoria**, escolha uma coluna textual ou numérica: cada valor distinto gera uma série no gráfico atual e seu próprio texto na legenda. As linhas de cada grupo mantêm a ordem de entrada. **Cor por categoria** permite indicar outra coluna com `#RRGGBB`, `#RGB`, nomes da paleta Grace (também em português) ou índices 0–15. Cores equivalentes são aceitas; cores conflitantes para a mesma categoria, categorias vazias e valores inválidos nas colunas X/Y/erro bloqueiam a importação com a linha do problema. Colunas textuais não selecionadas não são convertidas em números.

Confira a prévia com quantidade de séries, pontos e cores antes de clicar em **Criar N curvas**. **Usar exemplo com categorias** preenche uma tabela com dois grupos, erros e cores. A importação em lote é uma única operação de Desfazer/Refazer, e seus estilos, legendas e cores personalizadas são exportados como parâmetros AGR nativos. O agrupamento está disponível na adição de dados; editar uma série existente atualiza somente aquela série.
