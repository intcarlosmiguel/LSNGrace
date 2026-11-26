# Compatibilidade — motor Grace original

A prévia ativa e os exportadores usam **Grace 5.1.25 (`gracebat`)**, não o renderizador de aproximação TypeScript. A interface e o modelo não equivalem ainda ao conjunto completo de ferramentas do xmgrace.

| Recurso                                                       | Motor original                                          | Interface / limites                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Página, moldura, cores, fontes, ticks e eixos                 | Renderização nativa                                     | Propriedades comuns no inspetor; demais parâmetros em AGR                     |
| Sets XY e XYDY                                                | Renderização nativa                                     | Criação tabular, edição de dados e estilos                                    |
| Demais Sets numéricos e tipos de gráfico                      | Interpretados pelo Grace quando importados corretamente | Mapeador atual cria XY/XYDY; interações geométricas limitadas a XY            |
| Símbolos 0–11 e conexões                                      | Renderização nativa                                     | Selecionáveis no inspetor                                                     |
| Legenda                                                       | Renderização nativa                                     | Arraste com snap de 0,01 unidade de viewport                                  |
| Viewport                                                      | Geometria nativa                                        | Marcadores de redimensionamento; mantém unidade pela menor dimensão da página |
| Anotações, eixos alternativos, padrões e parâmetros avançados | Diretivas preservadas processadas pelo Grace            | Nem todos têm controles dedicados; usar editor AGR                            |
| Texto rico Grace e Symbol                                     | Interpretador nativo                                    | Acentos Latin-1 e conversão de letras gregas comuns                           |
| LaTeX moderno                                                 | Não interpretado automaticamente                        | Conversão continua pendente                                                   |
| Zoom, pan, seleção, duplo clique                              | Atualizam o documento, depois redesenham no Grace       | XY; arrastes agrupados no histórico                                           |
| AGR, SVG, PNG e EPS                                           | Saídas geradas pelo Grace original                      | AGR com cabeçalho 50122 e sformat de 17 dígitos; DPI ainda padrão do driver   |
| PDF                                                           | Indisponível neste binário Grace                        | Não oferecido na interface                                                    |
| Modo escuro/claro                                             | Não altera o documento                                  | Preferência persistente, página de publicação independente                    |
| Rascunho                                                      | Documento e nome salvos no navegador                    | Sem histórico e sem editor ainda não aplicado                                 |
| Formatos científicos adicionais, FFT e regressão              | Ponte ainda não expõe essas operações                   | Pendentes dos próximos marcos                                                 |

## Evidências

- `npm test`: modelo, parser, serialização, importação, encoding, autoscale, gestos e proteção da ponte.
- `npm run test:grace`: round-trip de quatro projetos no binário original.
- `npm run test:native`: geração real de AGR/SVG/PNG/EPS, texto acentuado/Symbol, símbolos, anotações e gráficos múltiplos; validação de precisão e rejeição de comandos externos.
- Build TypeScript/Vite e formatação verificados.
- `native-grace-dark.jpg`: captura da interface em modo escuro, com a página produzida pelo driver SVG do Grace original.
- Saídas baixadas pelo navegador reabertas: SVG com proveniência Grace, PNG com assinatura válida e AGR Latin-1 com acentos e símbolo estrela preservados.
- Navegador: identificação do motor real, seleção direta, duplo clique no eixo X, zoom, pan, Undo/Redo, arraste da legenda, aplicação de parâmetros AGR e tema persistente. A comparação do SVG antes/depois da troca de tema confirmou desenho inalterado.

## Limites relevantes

A preservação de parâmetros ainda não é uma AST completa do Grace. Comentários e whitespace não são mantidos; a ordem de diretivas desconhecidas em relação a campos normalizados pode mudar. O driver SVG usa nomes de fontes; aparência de fontes depende das fontes disponíveis no navegador. PNG/EPS usam os drivers nativos. Acesso a arquivos externos por comandos embutidos, hot-links e scripts arbitrários não são expostos pela ponte local.

O serviço acompanha `npm run dev` e `npm run preview`. Uma hospedagem puramente estática não pode iniciar o binário instalado. O pacote Tauri de produção ainda não inclui a ponte autônoma.

As fixtures `grace-reference.agr` e `grace-multigraph.agr` foram criadas pelo Grace 5.1.25 usando dados próprios; reproduza com `python3 scripts/generate-fixtures.py`. O binário exato 5.1.22 não foi testado. Capturas anteriores (`workspace.jpg`, `workspace-v2.jpg`, `data-editor-v2.jpg`) documentam as etapas antes da integração nativa.

## Redesign com foco no canvas

A interface foi reorganizada com referência no Desmos: uma lateral recolhível, um cabeçalho de 46 px e menus sob demanda. As propriedades substituem a lista, sem abrir uma segunda coluna. Editores de dados e AGR são painéis temporários sobre a área de trabalho.

Na janela de 1280 × 720 usada na verificação, o retângulo de plotagem passou de aproximadamente 367 × 257 px na versão anterior para 706 × 494 px: cerca de 3,7 vezes a área. Abrir as propriedades manteve a mesma largura de 706 px.

A câmera de apresentação foi testada para preservar os parâmetros de publicação, manter as coordenadas corretas de interação e não alterar a fonte SVG exportada. A visualização de página inteira continua acessível pelo menu. A exportação pelo navegador foi verificada separadamente com o viewBox original da página, sem o recorte usado na prévia.

Capturas do redesign: `desmos-layout-dark.jpg` e `desmos-layout-light.jpg`. Em 390 px de largura, a lista inicia recolhida e o documento não apresenta overflow horizontal.

## Aviso de conteúdo fora da página

O Grace retorna código 0 e gera SVG/PNG/EPS válidos ao emitir `Output is truncated - tune device dimensions`. A ponte trata especificamente essa mensagem como aviso recuperável, transmite-a na resposta e mantém a prévia visível. Mensagens de sintaxe desconhecidas, falhas de processo e SVG incompleto continuam sendo erros.

Regressão verificada com legenda e viewport fora da página nos três formatos gráficos, além do caso de aviso misturado a erro real. No navegador, o gráfico apareceu com o aviso discreto; reposicionar a legenda removeu o aviso, e Desfazer o restaurou sem derrubar o desenho. Teste executado em origem localhost separada para preservar o rascunho do endereço 127.0.0.1. Evidência: `truncation-warning-recovered.jpg`.
