# Transformações por série

Abra **botão direito na série → Transformações**. O painel apresenta editor à
esquerda, tabela no centro e instruções com exemplos clicáveis à direita.

Cada execução cria uma coluna C1, C2… e aplica o resultado ao eixo escolhido.
`x = ...` e `y = ...` na própria expressão têm precedência sobre o seletor de eixo.
Os dados originais X0/Y0 permanecem disponíveis, assim como as colunas auxiliares
D1, D2… de datasets com erros. O gráfico é ajustado aos dados visíveis após cada
alteração quando sua escala permite.

- `x`, `y`: coordenadas atualmente usadas pela série.
- `x0`, `y0`: coordenadas originais preservadas.
- `c1`, `c2`…: resultados das transformações anteriores.
- `d1`, `d2`…: colunas auxiliares originais; não são alteradas por transformações X/Y.
- `i`: número original da linha, começando em 1.

Exemplos:

```text
y = y - 20
x = x * 1e-3
y = log10(y)
y = (y - mean(y)) / std(y)
y = norm(y)
y = c1 * 2
y = sin(x) + y0
```

São aceitas as funções aritméticas do editor de regressão personalizada. Agregados
aceitam um nome de coluna: `mean`/`avg`, `sum`, `min`, `max`, `std`/`sd`.
O desvio padrão é amostral. `norm(coluna)` divide pela maior magnitude absoluta;
para uma coluna inteiramente zero, o resultado continua zero. Os cálculos usam
**todas as linhas, inclusive ocultas**. Domínios inválidos e resultados não finitos
interrompem a operação inteira, indicando a linha que falhou.

Cada coluna é um retrato do resultado daquela etapa. Excluir uma coluna não
recalcula resultados posteriores. Se a coluna excluída estiver sendo usada em X/Y,
o eixo correspondente volta ao original. Os botões X/Y dos cabeçalhos permitem
escolher outra coluna sem recalculá-la. Os originais não podem ser excluídos.

## Ocultar e restaurar linhas

O botão de olho de cada linha preserva todos os seus valores e a exclui apenas da
série desenhada. Assim, novos ajustes de regressão e exportações gráficas usam
somente as linhas visíveis. “Mostrar linhas ocultas” controla a apresentação da
tabela; “Mostrar todas” restaura todos os pontos. A tabela é paginada em blocos de
100 linhas, mantendo acesso a todos os valores.

Undo/Redo inclui criação/exclusão de colunas, vínculos X/Y e ocultação de linhas.
Relatórios de regressão anteriores continuam sendo retratos dos ajustes já feitos.

Para séries com tabela de transformações, a ferramenta de excluir ponto do canvas
oculta a linha original. A ferramenta de adicionar ponto oferece criar outra série;
adicionar diretamente à série transformada é bloqueado para preservar suas colunas.
Atualizar pelo editor **Dados** substitui a tabela completa e apresenta uma explicação
desse comportamento; a substituição também pode ser desfeita.

## Modelo e persistência

`DataSet.worksheet` mantém linhas originais, colunas calculadas, vínculos X/Y,
índices ocultos e um contador monotônico de colunas. `DataSet.rows` é a projeção das
coordenadas ativas com as linhas ocultas removidas; renderização, ajustes, autoscale
e exportação continuam consumindo essa projeção. Não há interpretação de código:
a mesma árvore aritmética segura do ajuste personalizado avalia as expressões.

O `.agr` contém apenas os pontos visíveis nos blocos nativos e a tabela completa
em comentários ASCII `# LSNGrace worksheet G0.S0 {JSON}`. O servidor preserva os
comentários e os estilos ao reexportar pelo processo Grace, mesmo se todas as linhas
estiverem ocultas e o Grace omitir o set vazio. Rascunhos locais preservam a mesma
tabela; templates `.par` não incluem os dados e metadados da tabela.

Na importação, metadados incompatíveis com os dados visíveis são ignorados com
aviso, preservando os dados do arquivo. Salvar diretamente pelo xmgrace clássico
pode descartar comentários da aplicação; os pontos visíveis continuam válidos.

## Verificação

`tests/transformations.test.ts` cobre encadeamento, referências a colunas originais,
agregados, erros em Y, exclusão de colunas ativas, linhas ocultas, falhas atômicas,
Undo/Redo, integração com edição de pontos, rascunhos, metadados desatualizados e
AGR produzido pelo Grace real, inclusive com todas as linhas ocultas.

O fluxo de menu, criação de duas colunas, ocultação de linha, exclusão de coluna e
Undo foi conferido na interface. Registro: `transformations-table.jpg`.

## Subitens e cópia entre séries

Cada coluna calculada aparece na árvore como subitem da série: **C1 · expressão**,
**C2 · expressão** etc. Clique no item para abrir sua tabela. O botão de copiar
junto ao subitem copia aquela fórmula; no menu de botão direito da série de destino,
use **Colar transformação**. **Copiar transformações** no menu da origem copia
as etapas disponíveis em conjunto. Ctrl+C/Ctrl+V funcionam quando a série está
com foco; Ctrl+C no subitem copia somente aquela transformação.

As fórmulas são recalculadas com os dados da série de destino, gerando novas
colunas sem substituir as anteriores. Valores da origem e máscaras de linhas não
são copiados. Referências explícitas a outras colunas, como `c1`, incluem suas
fórmulas de dependência e recebem novos IDs ao colar. Uma dependência cuja coluna
foi excluída gera uma mensagem explicativa. A operação de colagem é atômica e
forma uma única ação de Undo/Redo.

A cópia interna fica disponível durante a sessão da aplicação, mesmo se o navegador
não permitir acesso à área de transferência do sistema. Quando permitido, o botão
também copia a expressão (ou uma receita JSON de várias etapas) como texto.

`tests/transform-clipboard.test.ts` verifica recálculo na origem correta, destino com
colunas preexistentes, remapeamento, eixo X de expressões sem atribuição, dependências
excluídas, rejeição de conteúdo inválido, atomicidade e Undo/Redo. O fluxo de copiar
um subitem e colar em outra série foi conferido na interface.
