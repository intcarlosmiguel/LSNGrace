# Scene Graph v1

O contrato executável está em `src/core/scene/types.ts`. Ele representa o documento e reserva os tipos necessários às próximas etapas; não significa que cada propriedade já tenha parser e renderizador completos.

```text
Scene
├── schemaVersion / graceVersion
├── page: size (pt), background, fill
├── colors[]: índice, nome e RGB
├── fonts[]: índice, nome e nome alternativo
├── graphs[]
│   ├── id, enabled, hidden, type
│   ├── world / viewport
│   ├── title / subtitle
│   ├── axes: xaxis, yaxis, altxaxis, altyaxis
│   ├── frame
│   ├── sets[]: tipo, colunas numéricas, linha, símbolo, erros, legenda
│   ├── legend
│   └── annotations[]
├── annotations[]
└── compatibility: preserved[] / diagnostics[]
```

## Coordenadas

- Página: pontos PostScript, tamanho inicial `792 × 612`.
- Viewport: origem inferior esquerda; unidade igual a `min(width, height)`.
- World: limites ordenados; inversão pertence ao eixo, não aos limites.
- Escalas: `Normal`, `Logarithmic`, `Reciprocal`. Log requer domínio positivo; recíproca não pode cruzar zero.
- Renderização SVG: origem superior esquerda, com conversão explícita no módulo de geometria.

## Tipos e dados

Os tipos de Set preservam os identificadores do Grace e todas as colunas numéricas. Apenas XY e XYDY são desenhados no Marco 1. As contagens conhecidas de colunas são verificadas durante a leitura. Valores numéricos finitos usam a precisão do `number` JavaScript; o serializador não aplica arredondamento adicional aos dados.

`source` e `analysis` são contratos para os Marcos 3 e 4. Ainda não são persistidos como extensões AGR. A representação de anotações está definida, mas sua importação permanece textual nesta etapa; adicionar anotações diretamente às listas estruturadas provoca erro explícito na exportação até sua implementação.

## Preservação e serialização

A tabela compartilhada de campos descreve diretiva, caminho no modelo e codec. O parser e o serializador utilizam a mesma tabela. Diretivas reconhecidas são normalizadas; diretivas desconhecidas são preservadas textualmente em ordem por escopo global ou de gráfico.

Blocos `with string/line/box/ellipse` permanecem como diretivas globais ordenadas. Esse mecanismo não é uma AST completa do interpretador Grace e não garante equivalência para qualquer sequência arbitrária de comandos. Diretivas globais preservadas são emitidas antes dos gráficos, e as de gráfico antes dos campos modelados. Essa limitação está exposta na matriz de compatibilidade.

Comentários e whitespace não são preservados. O round-trip exigido para campos modelados é semântico, não igualdade de bytes. A saída usa `@version 50122`, identificadores originais, `@with gN`, propriedades `sN`, blocos `@target GN.SN`, `@type` e `&`.

## Estado e histórico

O store Zustand guarda documento, seleção e histórico em propriedades separadas. O renderer recebe apenas `Scene`. Edições usam Immer com compartilhamento estrutural e desfazer/refazer restaura snapshots imutáveis. Ajustes de estilo compartilham os mesmos arrays de pontos; alterar um ponto copia somente o array e a linha afetados. O histórico continua em memória, sem limite explícito. Validação, serialização e alvos de seleção reutilizam blocos numéricos profundamente congelados. Entradas mutáveis não usam esses caches.

## Desktop

React e o núcleo TypeScript funcionam no navegador e no WebView Tauri. O shell Rust inicial não duplica o parser. Quando o parsing pesado migrar para workers/Rust, usará o mesmo contrato serializado, acompanhado de testes de equivalência. Não há file watcher nem acesso irrestrito ao filesystem no shell inicial.

## Motor nativo e camada de interação

Desde a integração nativa, a interface ativa não usa o renderizador SVG TypeScript como autoridade visual. O Scene Graph continua sendo o documento editável; sua serialização AGR alimenta `gracebat`. O driver original desenha a página. Até 99.999 pontos visíveis, a prévia usa SVG nativo, com namespace/metadados, unidades CSS de fonte explícitas e sanitização. A partir de 100 mil pontos, usa PNG gerado pelo próprio Grace em um wrapper SVG que preserva o enquadramento e as coordenadas de interação. As exportações SVG/EPS continuam vetoriais e contêm os dados completos. A interface não recalcula a geometria nativa.

A camada SVG transparente de interação tem alvos de curva/ponto, eixos, título, legenda e viewport. Ela não faz parte da figura exportada. Zoom/pan alteram world; arrastes alteram a posição da legenda ou viewport no Scene Graph. Um arraste gera uma única entrada no histórico. A prévia nativa é atualizada com debounce, cancelamento de processos obsoletos e indicação de processamento.

A interface usa uma preferência de tema separada do Scene Graph (`lsngrace.theme`). Trocar o tema não altera nenhuma propriedade de publicação e não aplica filtro ou inversão ao desenho.

`server/grace.ts` executa o binário com argumentos estruturados, `-safe`, limites de tamanho, timeout e diretório temporário exclusivo. `server/plugin.ts` disponibiliza o mesmo serviço em dev e preview. Não são aceitos scripts de I/O nem comandos externos contidos em arquivos AGR. A distribuição desktop autônoma exigirá transportar essa ponte para Rust ou um sidecar empacotado.

## Custos de interação e limites dos caches

O DOM nativo fica isolado em um componente memoizado. A camada de seleção usa uma trajetória por série, inclusive para pontos desconectados, sem criar um círculo DOM por amostra. Sua geometria é reutilizada por identidade dos dados e parâmetros completos de coordenadas, com até duas geometrias por bloco numérico.

A prévia possui cache de cinco revisões, limitado a 24 MiB, com liberação de URLs de imagens ao descartar entradas. A ponte possui LRU de oito saídas, limitado a 32 MiB, identificado por SHA-256 do AGR e formato. A fila nativa permite dois processos simultâneos e cancela trabalhos obsoletos; bursts normais aguardam uma vaga. O debounce da prévia é de 60 ms. O zoom por roda acumula alterações enquanto a prévia é atualizada.

O salvamento local aguarda uma pausa de 600 ms e executa em um período ocioso quando disponível, com prazo de 1,5 s. Os números congelados são serializados uma única vez por bloco; `pagehide` continua gravando o documento atual. A leitura inicial mantém compatibilidade com os rascunhos existentes. [Medições e validações](../compatibility/performance.md).

## Zoom e transparência

Mudanças apenas de coordenadas podem exibir uma camada Canvas2D temporária com amostragem limitada durante o gesto, enquanto o resultado nativo é produzido. Essa camada não é usada para exportação nem modifica os arrays de dados. A seleção fica suspensa durante a espera para evitar reconstruir trajetórias grandes a cada evento de roda.

`DataSet.opacity` e `symbol.fill.opacity` são extensões opcionais, com valor padrão 1. O serializador as preserva em comentários AGR compatíveis, que o parser recupera. O backend identifica tintas temporárias do SVG do Grace e aplica opacidade apenas aos componentes correspondentes. PNG com alpha é rasterizado desse SVG; EPS usa composição sobre o fundo e AGR mantém a extensão com aviso explícito sobre o Grace clássico.
