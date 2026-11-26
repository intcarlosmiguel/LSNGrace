# Regressão de séries

Use **Ctrl+clique** (ou Cmd+clique) na curva ou no nome da série na árvore.
Também há um botão **Regressão…** nas propriedades da série. O quadro é não modal,
fecha com Escape ou clique fora e permite escolher o modelo, restringir os dados por
X, definir a malha da curva e criar uma série adicional de resíduos.

Cada ajuste gera uma série XY e um objeto `RegressionReport` em
`Graph.regressions`, exibido como **Informações da regressão** recuado sob a
série ajustada na árvore.
Clique nesse item para consultar equação, coeficientes, erros padrão, R², R²
ajustado, SSE, RMSE, erro padrão residual, graus de liberdade e intervalo.
O relatório é um retrato do ajuste: alterações posteriores nos dados não o recalculam.
A criação da curva, do relatório e dos resíduos forma uma única ação de Undo/Redo.
Excluir informações mantém a curva; a exclusão também pode ser desfeita.
Excluir a curva ajustada remove também o relatório subordinado na mesma ação.

O botão direito na série, no gráfico ou na imagem da árvore abre um menu com
**Configurações**, **Regressão**, **Dados** e **Excluir**. Para imagem ou gráfico,
Regressão e Dados permitem escolher explicitamente a série (Dados também oferece
adicionar dados ao gráfico). As exclusões podem ser desfeitas com Ctrl+Z.
Excluir a imagem limpa o documento atual; excluir o último gráfico mantém um
gráfico vazio para continuar a edição. Escape e clique fora fecham o menu;
setas, Home, End e Enter permitem navegar pelo teclado.

## Métodos e convenções

| Modelo                 | Equação                         | Objetivo minimizado                  |
| ---------------------- | ------------------------------- | ------------------------------------ |
| Linear                 | y = a0 + a1 x                   | Soma dos quadrados dos resíduos em Y |
| Polinomial (grau 1–10) | y = a0 + a1 x + … + an xⁿ       | Resíduos em Y                        |
| Potência               | y = A xᴮ                        | Resíduos em ln(Y), com X,Y > 0       |
| Exponencial            | y = A exp(B x)                  | Resíduos em ln(Y), com Y > 0         |
| Logarítmica            | y = A + B ln(x)                 | Resíduos em Y, com X > 0             |
| Inversa                | y = 1/(A + B x)                 | Resíduos em 1/Y, com Y ≠ 0           |
| Gaussiana              | y = base + A exp(−(x−μ)²/(2σ²)) | Resíduos em Y; σ > 0                 |
| Lorentziana            | y = base + A/(1+((x−x0)/γ)²)    | Resíduos em Y; γ > 0                 |

Os modelos clássicos usam QR com reortogonalização e centralização/escala de X.
Os picos usam Levenberg–Marquardt, X/Y normalizados e largura parametrizada por
logaritmo. Valores iniciais podem ser automáticos ou fornecidos como
`base; amplitude; centro; largura`. O motor rejeita não convergência, sistemas
singulares e curvas que cruzam polos da função inversa.

Todos os ajustes são **não ponderados**: DX/DY não entram no objetivo.
O modelo Personalizada permite fórmulas próprias, limites e parâmetros fixos.
Os erros padrão usam covariância local e variância residual estimada na escala do
objetivo; A nos modelos linearizados usa propagação de erro (método delta).
R², SSE e RMSE são calculados em Y original, inclusive para modelos transformados;
o relatório mostra separadamente o SSE do objetivo. R² é indefinido para Y constante.
São exigidos mais pontos que parâmetros para estimar a variância residual.

## Regressão personalizada (Grace + LaTeX)

Escolha **Personalizada** no quadro de regressão. Informe, por exemplo:

```text
y = a0 * exp(-x / a1) + a2
$y = a_0 \exp\left(-\frac{x}{a_1}\right) + a_2$
```

As duas fórmulas definem o mesmo modelo. A interface detecta os parâmetros, mostra
uma prévia matemática em MathML e a expressão interpretada. Para cada parâmetro,
informe um valor inicial e, opcionalmente, mínimo, máximo ou **Fixar**. Há controle
de tolerância (1e-12 a 0,01) e de máximo de iterações (1 a 1000).

São aceitos de 1 a 10 parâmetros: `a0…a9` (ou `a_0…a_9`) e letras gregas
`alpha`, `beta`, `gamma`, `delta`, `epsilon`, `theta`, `lambda`, `mu`, `nu`,
`sigma`, `tau`, `phi`, `omega`, com índice opcional de 0 a 9. Também podem ser
escritas com comandos LaTeX ou glifos Unicode. `x` é a variável independente;
`pi` e `e` são constantes. Produtos podem ser explícitos (`a0*x`) ou implícitos
(`a_0 x`). Potências usam `^` ou `**`; `-x^2` significa `-(x^2)`.

Funções: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `sinh`, `cosh`,
`tanh`, `asinh`, `acosh`, `atanh`, `exp`, `ln`, `log`, `log10`, `log2`, `sqrt`,
`sqr`, `abs`, `pow`, `sgn`, `minof`, `maxof`. `ln` e `log` são logaritmos naturais.
O subconjunto LaTeX inclui frações, raízes quadradas, potências, subscritos,
funções, `\left`, `\right`, `\cdot`, `\times`, `\operatorname`, `\mathrm` e os
delimitadores `$…$`, `$$…$$`, `\(…\)`, `\[…\]`. Outros comandos, funções
especiais do Grace, lógica condicional e integrais simbólicas não estão implementados;
o parser informa o trecho incompatível. O campo de ajuda lista o suporte disponível.

O parser constrói uma árvore aritmética, sem `eval` ou execução de código.
O solver Levenberg–Marquardt usa derivadas numéricas, escala de parâmetros,
normalização de Y, projeção nos limites e solução QR. Pontos fora do domínio,
não convergência e parâmetros não identificáveis interrompem a criação da curva.
Os graus de liberdade descontam apenas parâmetros livres; coeficientes fixos ou
que atingiram os limites não recebem erro padrão. As incertezas são aproximações
locais. Fórmula original, expressão interpretada, iniciais, limites, tolerância e
máximo de iterações ficam salvos junto ao relatório no AGR e no rascunho.

## Persistência e compatibilidade

As curvas continuam sendo datasets `@type xy` normais. Os relatórios são gravados
em comentários ASCII `# LSNGrace regression G0 {JSON}`, aceitos e ignorados pelo
Grace clássico. O exportador nativo do servidor recoloca esses comentários após a
reescrita pelo Grace; parser, rascunhos e histórico local preservam o relatório.
Exportação de template `.par` omite relatórios. Salvar novamente pelo próprio
xmgrace pode descartar os comentários da aplicação, mantendo as curvas.

## Referências consultadas

- [Grace User's Guide, Data / Regression e Non-linear fit](https://plasmagate.weizmann.ac.il/Grace/doc/UsersGuide.html): polinômios, modelos linearizados, valores ajustados, resíduos e malha da função.
- [Grace FAQ, Mathematics](https://plasmagate.weizmann.ac.il/Grace/doc/FAQ.html#ss8.1): o ajuste não linear clássico usa Levenberg–Marquardt baseado no LMDIF/MINPACK. Aqui foi implementado um solver TypeScript próprio com modelos de pico e fórmulas personalizadas.

## Verificação

`tests/regression.test.ts` cobre os oito modelos, valores OLS conhecidos,
incerteza dos parâmetros, X com grande deslocamento, restrição de intervalo,
domínios inválidos, singularidades, Undo/Redo, rascunho, AGR e renderização/exportação
pelo processo real do Grace. O fluxo de Ctrl+clique, criação da curva e abertura do
relatório também foi conferido na interface.

`tests/custom-regression.test.ts` acrescenta equivalência Grace/LaTeX, precedência,
funções, parâmetros gregos, entradas inválidas, ajustes personalizados, iniciais,
limites, parâmetros fixos, covariância e persistência pelo processo Grace real.
O fluxo completo com fórmula LaTeX e criação do relatório foi conferido na interface.
