const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
/** Modified Gram–Schmidt with reorthogonalization. No normal equations. */
export function leastSquares(matrix: number[][], y: number[]) {
  const m = matrix[0].length,
    q: number[][] = [],
    r = Array.from({ length: m }, () => Array(m).fill(0));
  for (let j = 0; j < m; j++) {
    const v = matrix.map((row) => row[j]);
    const originalNorm = Math.sqrt(dot(v, v));
    for (let pass = 0; pass < 2; pass++)
      for (let i = 0; i < j; i++) {
        const d = dot(q[i], v);
        r[i][j] += d;
        for (let k = 0; k < v.length; k++) v[k] -= d * q[i][k];
      }
    r[j][j] = Math.sqrt(dot(v, v));
    if (r[j][j] <= Math.max(originalNorm, 1) * 1e-12)
      throw Error('Ajuste singular: X não contém valores independentes suficientes.');
    q.push(v.map((x) => x / r[j][j]));
  }
  const solve = (b: number[]) => {
    const x = Array(m).fill(0);
    for (let i = m - 1; i >= 0; i--)
      x[i] = (b[i] - r[i].reduce((s, v, j) => s + (j > i ? v * x[j] : 0), 0)) / r[i][i];
    return x;
  };
  const coefficients = solve(q.map((col) => dot(col, y)));
  const inverseColumns = Array.from({ length: m }, (_, j) =>
    solve(Array.from({ length: m }, (_, i) => +(i === j))),
  );
  const covariance = Array.from({ length: m }, (_, i) =>
    Array.from({ length: m }, (_, j) => inverseColumns.reduce((sum, c) => sum + c[i] * c[j], 0)),
  );
  return { coefficients, covariance };
}
