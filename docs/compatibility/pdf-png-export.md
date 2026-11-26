# Exportação PDF e PNG

Em **Exportar → Tipo de arquivo**, escolha **PDF · vetorial** ou **PNG · imagem
rasterizada**. PDF preserva o tamanho físico da página, linhas vetoriais, fontes
incorporadas, transparência e fórmulas LaTeX. Sua geração usa o SVG final do Grace
com as extensões da aplicação, convertido por librsvg/Cairo. O processo é local:
Python 3 e bibliotecas Cairo/librsvg do sistema, sem instalar pacotes Python ou
fazer requisições externas. No Debian/Ubuntu, os pacotes são `python3`,
`libcairo2` e `librsvg2-2`.

PNG usa a mesma versão final do SVG, com ambas as dimensões de saída definidas
explicitamente. Dimensões de pixel seguem `round(pontos × DPI / 72)` e o DPI fica
no chunk pHYs. A saída padrão sem DPI explícito é 96 DPI; a interface oferece
72, 96, 150, 300, 600, 1200 e valor personalizado. Mantém os limites de memória de
144 milhões de pixels/20 mil pixels por lado. Exportações rasterizadas são
serializadas por uma fila e renderizadas de forma assíncrona, evitando bloquear o
servidor durante a etapa de desenho. Arquivos PNG têm assinatura, dimensões e
metadados verificados pelos testes, incluindo DPI fracionário.

A prévia de figuras com 100 mil pontos conserva o caminho rápido do driver PNG
nativo por meio da opção interna `nativePreview`; ela não determina a resolução
ou o conteúdo da exportação final. O download usa um link anexado ao documento
e mantém o Blob disponível por 60 segundos, dando tempo para iniciar o salvamento.

## Verificação

`tests/pdf-png-export.test.ts` cobre:

- PNG válido (assinatura, CRC de todos os chunks, IDAT descomprimível, IEND);
- dimensões físicas e DPI em 96, 96,2, 300, 600 e 1200 DPI;
- LaTeX, transparência e disponibilidade da prévia nativa;
- PDF válido em uma página Letter paisagem, fontes incorporadas e ausência de
  rasterização da figura de teste;
- rejeição de DPI em formatos vetoriais e limites dos metadados PNG.

O PDF gerado também foi inspecionado com `pdfinfo`, `pdffonts`, `pdfimages` e
renderizado por `pdftoppm` para conferência visual de título matemático, legenda,
curvas e barras de erro. As amostras PNG de 96/150/300/600 DPI foram geradas com
sucesso; a confirmação da causa específica do PNG relatado depende da mensagem
ou descrição do problema observado pelo usuário.

Referências de implementação: [librsvg render_document](https://gnome.pages.gitlab.gnome.org/librsvg/Rsvg-2.0/method.Handle.render_document.html),
[Cairo PDF surfaces](https://cairographics.org/manual/cairo-PDF-Surfaces.html).
