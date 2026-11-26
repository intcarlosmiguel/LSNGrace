# Plano de desenvolvimento do LSNGrace

## Direção

Compatibilidade deve ser demonstrada por fixtures, leitura no Grace original e comparação visual. O Scene Graph é a única fonte do documento; renderizadores e exportadores consomem esse mesmo modelo. Recursos não implementados devem ser diagnosticados e preservados quando possível, sem alegação prematura de fidelidade total.

## Marco 1 — Core e AGR

Implementado nesta entrega:

- Schema v1 tipado para página, fontes/cores, gráficos, eixos, Sets, legendas, anotações e metadados de compatibilidade.
- Parser/serializador AGR, dados XY/XYDY, IDs esparsos e diagnóstico por linha.
- Preservação de diretivas desconhecidas por escopo.
- Renderizador SVG: world/viewport, escalas linear/log/recíproca, inversão, ticks, moldura, curvas e barras de erro.
- Interface web executável: abrir/salvar, inspeção básica, ocultação e seleção de Sets.
- Histórico inicial, exportação SVG e estrutura do shell Tauri.
- Fixtures produzidas pelo Grace 5.1.25; testes de ida e volta e validação pelo gracebat.

Antes de declarar fidelidade visual completa: ampliar o corpus, calibrar tipografia e espessuras, criar comparação visual automatizada e executar testes também no Grace 5.1.22. A compilação Tauri permanece pendente de toolchain Rust.

## Atualização — criação de gráficos com dados próprios

Entregue antes de ampliar o restante do Marco 2:

- Interface reorganizada com controles legíveis, ícones SVG e enquadramento da página conforme o espaço disponível.
- Gráfico vazio inicial, botão Novo gráfico e editor de dados sem modal.
- Importação CSV/TSV/DAT/TXT, colagem de tabela, seleção de X/Y/DY e preview validado.
- Múltiplas séries, atualização dos dados preservando estilo, remoção reversível e autoscale com incertezas.
- Inspetor com escalas, grade, inversão, legenda, símbolos básicos e linhas.
- Rascunho local persistente e proteção contra configurações inválidas.
- Responsividade verificada no navegador, incluindo largura reduzida; polling no servidor de desenvolvimento para evitar CSS desatualizado em arquivos montados.

Essas entregas antecipam a ingestão tabular do Marco 3. Planilhas, formatos binários, watchers e fallback gráfico continuam pendentes.

## Atualização — motor Grace original e modo escuro

Entregue:

- Motor real `gracebat` conectado à prévia e às saídas AGR/SVG/PNG/EPS.
- Tratamento de Latin-1, acentos e Symbol; saída AGR pelo serializador do próprio Grace.
- Seleção direta de curvas/pontos, duplo clique em eixos/título, zoom por área e pan.
- Arraste de legenda e cantos do viewport com Undo/Redo por gesto.
- Parâmetros AGR editáveis, validados pelo interpretador nativo antes da aplicação.
- Símbolos 0–11 e conexões nativas no inspetor.
- Modo escuro/claro persistente, separado das cores da figura.

O objetivo é uma interface moderna para o motor original. Isso não conclui o porte de todas as ferramentas do xmgrace: análise, regressão, watchers, formatos adicionais e empacotamento desktop continuam pendentes.

## Marco 2 — UX e manipulação direta

1. Continuar a separação do workspace e gerenciador de Sets em features (editor de dados e inspetor já separados).
2. Introduzir comandos de edição e agrupar gestos no histórico sem copiar arrays de dados por ajuste.
3. Zoom/pan, box zoom, autoscale e atalhos; manipulação de viewport/legenda com guias.
4. Duplo clique contextual, edição inline e reordenação das séries.
5. Completar símbolos, estilos, eixos alternativos e representação estruturada de anotações.
6. Implementar composição de texto Grace/LaTeX com preservação da origem.
7. Adicionar command palette, acessibilidade e testes de interação.

Aceitação: um gráfico deve poder ser editado por teclado e manipulação direta, com undo/redo consistente e exportação compatível de todas as propriedades alteradas.

## Marco 3 — Ingestão moderna e hot-links

1. Definir tabela intermediária e contratos de importação/cancelamento.
2. CSV/TSV/DAT/TXT e JSON/JSONL, com preview, mapeamento e NXY.
3. XLS/XLSX e seleção de abas.
4. Parquet e HDF5, incluindo seleção de datasets/grupos; NPY/NPZ.
5. Adapters Rust para I/O pesado, watchers, debounce e substituições atômicas.
6. Manter dados e estilo separados no modelo durante recargas; tratar conflitos entre edição e atualização do arquivo.
7. Medir carga de grandes séries; implementar fallback Canvas/WebGL e política de seleção de backend.

Aceitação: recarregar arquivos vinculados preserva estilo e não bloqueia a interface; arquivos incompletos ou removidos não substituem dados válidos silenciosamente.

## Marco 4 — Análise e exportação

1. Avaliador de expressões com operações permitidas e sem avaliação arbitrária de código.
2. Média móvel, Savitzky–Golay, derivada, integral, interpolação e FFT.
3. Ajustes linear/polinomial e não lineares, com parâmetros, convergência e R².
4. Exportadores PDF/EPS e PNG 300/600/1200 DPI; calibração de fontes.
5. Exportação `.par` pela interface (núcleo inicial já disponível).
6. CLI headless com fluxos equivalentes aos casos definidos do gracebat.

Aceitação: resultados comparados com referências numéricas conhecidas e saídas gráficas verificadas em tamanho físico, resolução, fontes e recorte.

## Regras de conclusão

Cada marco deve registrar escopo implementado, limitações, testes, evidências e pendências. Os marcos seguintes não substituem os testes de regressão de compatibilidade dos anteriores. Estimativas de prazo serão definidas após a medição do corpus e do desempenho inicial.

## Atualização de design — menos controles permanentes

- Referência visual e de organização: Desmos.
- Canvas ampliado; remoção do inspetor direito, barras e cabeçalhos duplicados.
- Propriedades sob demanda na própria lateral, lista recolhível e menus de projeto/exportação.
- Câmera de prévia focada no gráfico, com página inteira opcional e exportação intacta.
- Entrada de dados e AGR em painéis temporários; modo escuro com tons neutros.
- Verificação de layout, geometria de interação e invariantes de publicação.
