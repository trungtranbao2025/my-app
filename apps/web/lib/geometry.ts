export type Point = { x: number; y: number }

export type ControlPoints = {
  base: [Point, Point]
  overlay: [Point, Point]
}

export type Similarity = {
  s: number
  thetaRad: number
  tx: number
  ty: number
  matrix: [number, number, number, number, number, number] // [a,b,c,d,tx,ty]
}

export function computeSimilarity(cp: ControlPoints): Similarity {
  const [P1b, P2b] = cp.base
  const [P1o, P2o] = cp.overlay
  const vb = { x: P2b.x - P1b.x, y: P2b.y - P1b.y }
  const vo = { x: P2o.x - P1o.x, y: P2o.y - P1o.y }
  const nb = Math.hypot(vb.x, vb.y)
  const no = Math.hypot(vo.x, vo.y)
  if (no === 0 || nb === 0) throw new Error('Degenerate control points')
  const s = nb / no
  const theta = Math.atan2(vb.y, vb.x) - Math.atan2(vo.y, vo.x)
  const cos = Math.cos(theta), sin = Math.sin(theta)
  const a = s * cos, b = s * sin, c = -s * sin, d = s * cos
  const tx = P1b.x - (a * P1o.x + c * P1o.y)
  const ty = P1b.y - (b * P1o.x + d * P1o.y)
  return { s, thetaRad: theta, tx, ty, matrix: [a, b, c, d, tx, ty] }
}

export function applySimilarity(p: Point, T: Similarity): Point {
  const [a,b,c,d,tx,ty] = T.matrix
  return { x: a*p.x + c*p.y + tx, y: b*p.x + d*p.y + ty }
}
