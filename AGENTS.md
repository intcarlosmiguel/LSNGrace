# Papel e Objetivo
Atue como um Engenheiro de Software Sênior especialista em computação científica, renderização vetorial 2D e design de interfaces de alta produtividade. Seu objetivo é projetar e implementar uma aplicação desktop/web moderna (padrão 2026) inspirada no **xmgrace (Grace)**, combinando **100% de fidelidade visual e compatibilidade de arquivo (`.agr`)** com o xmgrace clássico, mas com uma **experiência de usuário (UX) intuitiva, reativa e contemporânea**, além de suporte nativo aos formatos de dados científicos atuais.

---

# 1. Arquitetura Técnica Recomendada
- **Stack:** Tauri v2 (backend em Rust para I/O rápido, file watchers e parsing de grandes volumes de dados) + Frontend em React, TypeScript, Tailwind CSS e Zustand (gerenciamento de estado com histórico completo de Undo/Redo).
- **Motor Gráfico (Core):** Renderizador vetorial híbrido (SVG de alta precisão para fidelidade tipográfica/exportação + Canvas2D/WebGL fallback automático para séries com >100.000 pontos sem perda de FPS).
- **Single Source of Truth (Scene Graph):** Todo o estado do gráfico deve residir em um modelo JSON tipado que espelha exatamente a estrutura hierárquica do `.agr` (`Page` -> `Graphs [G0..Gn]` -> `Axes`, `Sets [S0..Sn]`, `Legend`, `Annotations`). Tanto o renderizador na tela quanto o exportador `.agr` devem consumir exclusivamente esse mesmo modelo.

---

# 2. Fidelidade Visual Absoluta ao xmgrace (Padrão de Publicação)
O motor de renderização deve replicar fielmente a estética clássica do Grace por padrão:
1. **Sistema de Coordenadas Duplo:**
   - **Page & Viewport:** Tamanho de página padrão (`792 x 612 pt` - Landscape Letter) e área de plotagem (`Viewport`) em coordenadas normalizadas `[0.0, 1.0]` (ex.: `xmin=0.15, ymin=0.15, xmax=0.85, ymax=0.85`).
   - **World Coordinates:** Escalas independentes (`Linear`, `Logarithmic`, `Reciprocal`) com eixos invertíveis.
2. **Moldura e Ticks (Assinatura Visual do Grace):**
   - Caixa fechada (4 bordas: inferior, superior, esquerda, direita) com espessura de linha configurável.
   - **Ticks apontando para dentro (`in`)** por padrão em todos os 4 lados (eixos principais e opostos), com subdivisões precisas entre `major ticks` e `minor ticks` e formatação numérica (`decimal`, `exponential`, `power`, `scientific`, `general`).
3. **Paleta de Cores Indexada Oficial (0 a 15):**
   - Implementar exatamente os índices padrão do Grace para retrocompatibilidade: `0: White (#FFFFFF)`, `1: Black (#000000)`, `2: Red (#FF0000)`, `3: Green (#00FF00)`, `4: Blue (#0000FF)`, `5: Yellow (#FFFF00)`, `6: Brown (#BC8F8F)`, `7: Grey (#DCDCDC)`, `8: Violet (#9400D3)`, `9: Cyan (#00FFFF)`, `10: Magenta (#FF00FF)`, `11: Orange (#FFA500)`, `12: Indigo (#7221BC)`, `13: Maroon (#670748)`, `14: Turquoise (#40E0D0)`, `15: Green4 (#008B00)`, além de permitir cores customizadas RGB/Hex via diretiva `@map color`.
4. **Símbolos, Linhas e Tipos de Set:**
   - **Símbolos (0 a 11):** `0: None`, `1: Circle`, `2: Square`, `3: Diamond`, `4: Triangle Up`, `5: Triangle Left`, `6: Triangle Down`, `7: Triangle Right`, `8: Plus (+)`, `9: X`, `10: Star`, `11: Char` (caractere customizado), com controle independente de borda (cor, espessura) e preenchimento (cor, padrão de hachura).
   - **Estilos de Linha:** `None`, `Solid`, `Dotted`, `Dashed`, `Long Dashed`, `Dot-Dashed`, mais estilos de conexão (`Straight`, `Left/Right Stairs`, `Segments`, `3-Pt Spline`).
   - **Tipos de Dataset suportados:** `XY`, `XYDX`, `XYDY`, `XYDXDY`, `XYDXDXDYDY` (barras de erro simétricas e assimétricas com controle de riser e cap), `BAR`, `BARDY`, `XYHILO`, `XYBOXPLOT` e `XYSIZE`.
5. **Tipografia e Equações Científicas:**
   - Fontes vetoriais estilo publicação (Nimbus Roman / Times, Helvetica, Symbol, Latin Modern Math).
   - Parser bidirecional de texto rico: traduzir automaticamente sequências clássicas do Grace (`\f{Symbol}a\f{}`, `\S2\N`, `\s0\N`) e sintaxe **LaTeX moderna** (`$\alpha_0^2$`) para renderização vetorial limpa, preservando a sintaxe compatível ao exportar `.agr`.

---

# 3. Ingestão Moderna de Dados (Input Pipeline)
Substituir o antigo diálogo ASCII do Motif por um pipeline unificado (Drag-and-Drop na janela, menu ou colar da área de transferência):
- **Formatos Suportados:**
  - Tabulares: `.csv`, `.tsv`, `.dat`, `.txt` (detecção automática de delimitadores, cabeçalhos e linhas de comentário `#` ou `@`).
  - Planilhas e Big Data Científico: `.xlsx` / `.xls` (com seletor de abas), `.parquet`, `.json` / `.jsonl`.
  - Binários Científicos: `.h5` / `.hdf5` (navegador de grupos/datasets) e `.npy` / `.npz`.
  - Legado: Importação completa de projetos `.agr` e templates de estilo `.par`.
- **Mapeador Visual de Colunas (Block Data Moderno):**
  - Ao carregar um arquivo multicoluna, exibir um preview rápido onde o usuário atribui visualmente colunas a `X`, `Y`, `DX`, `DY` (ou importa múltiplas curvas `NXY` em lote com 1 clique).
- **Hot-Links (Live Reload):**
  - Opção de vincular um dataset ao arquivo original no disco (OS File Watcher): se uma simulação ou script Python atualizar o `.csv`/`.dat`, o gráfico re-renderiza instantaneamente mantendo toda a estilização.

---

# 4. UX/UI Intuitiva de 2026 (Zero Janelas Modais)
Eliminar completamente o fluxo antigo de "abrir janela -> clicar Apply -> clicar Accept -> fechar":
1. **Manipulação Direta no Canvas:**
   - **Duplo clique contextual:** Clicar duas vezes no eixo X abre imediatamente as propriedades do eixo X; duplo clique na curva seleciona o Set; duplo clique no título ou legenda permite edição inline.
   - **Drag & Drop com Guias Magnéticas:** Arrastar legendas, anotações de texto e bordas do `Viewport` diretamente no gráfico com snap inteligente.
   - **Navegação Fluida:** Zoom com scroll do mouse, Box-Zoom arrastando o cursor, botão/atalho `A` para Autoscale instantâneo e `Ctrl+Z` / `Ctrl+Y` ilimitado.
2. **Painel Inspetor Lateral Reativo (estilo Figma/Linear):**
   - Painel direito sensível ao elemento selecionado (Página, Grafo, Eixos, Curva/Set, Legenda) com atualização em tempo real (0ms de latência) a cada ajuste de slider, cor ou fonte.
   - Gerenciador de Sets na barra lateral esquerda com drag-and-drop para reordenar camadas, olho para ocultar/exibir e badges indicando o tipo (`XY`, `XYDY`).
3. **Command Palette (`Cmd/Ctrl + K`) e Modo Batch:**
   - Acesso rápido a qualquer transformação, estilo ou exportação pelo teclado.
   - Suporte a modo headless via CLI (compatível com o fluxo do `gracebat`) para automatizar a geração de figuras a partir de arquivos `.agr` + novos dados.

---

# 5. Transformações Matemáticas e Ajuste de Curvas
Incluir ferramentas essenciais de análise diretamente nos Sets:
- **Avaliador de Expressões:** Transformações vetoriais rápidas estilo Grace (ex.: `y = y - 20`, `y = norm(y)`, `x = x * 1e-3`, `y = log10(y)`).
- **Processamento de Sinais:** Suavização (média móvel, Savitzky-Golay), derivada numérica ($dy/dx$), integral definida, interpolação e FFT.
- **Curve Fitting (Regressão):** Ajuste linear, polinomial, exponencial, gaussiano e lorentziano (Levenberg-Marquardt) gerando automaticamente um novo Set com a curva ajustada e exibindo $R^2$ e parâmetros na legenda/inspetor.

---

# 6. Exportação Fiel (.agr + Publicação)
- **Exportação `.agr` Nativa (Round-Trip Fidelity):** Gerar arquivos ASCII `.agr` estritamente válidos (cabeçalho `@version 50122`, diretivas `@with g0`, `@s0`, blocos `@target G0.S0` / `@type xy` seguidos de `&`) que abrem sem erros ou perda de formatação no `xmgrace` original.
- **Exportação `.par`:** Salvar apenas os parâmetros visuais (sem dados) para aplicar o mesmo template a dezenas de gráficos.
- **Exportação Gráfica Vetorial e Raster:** Exportação direta em 1 clique para **PDF vetorial**, **SVG**, **EPS** (PostScript encapsulado com fontes embutidas para LaTeX) e **PNG** de alta resolução (300, 600 e 1200 DPI).

---

# 7. Plano de Entrega Incremental
Implemente o projeto em 4 marcos verificáveis:
1. **Marco 1 (Core & Parser `.agr`):** Definir o schema TypeScript da Scene Graph, implementar o parser e o serializador `.agr` (testando round-trip com arquivos reais do Grace) e construir o renderizador SVG básico (moldura, ticks internos, eixos e curvas `XY`/`XYDY`).
2. **Marco 2 (UX Reativa & Manipulação Direta):** Construir a interface principal (barra lateral de Sets, canvas interativo com zoom/pan/seleção e painel inspetor lateral reativo) + suporte a LaTeX e símbolos.
3. **Marco 3 (Ingestão Moderna & Hot-Links):** Integrar os parsers de `.csv`, `.xlsx`, `.parquet`, `.json` e `.hdf5`, o mapeador visual de colunas e o file watcher em tempo real.
4. **Marco 4 (Análise & Exportação Vetorial):** Adicionar transformações matemáticas, curve fitting e os exportadores finais (`.pdf`, `.eps`, `.svg`, `.png` high-DPI).

Comece agora apresentando a estrutura de pastas do projeto, o schema completo da `Scene Graph` em TypeScript e a implementação funcional do **Marco 1**.