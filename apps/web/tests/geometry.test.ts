import { expect, test } from 'vitest'
import { computeSimilarity, applySimilarity } from '../lib/geometry'

test('similarity 2-point alignment scaling only', () => {
  const sim = computeSimilarity({
    base: [{x:0,y:0},{x:10,y:0}],
    overlay: [{x:0,y:0},{x:5,y:0}]
  })
  expect(sim.s).toBeCloseTo(2, 6)
  expect(sim.thetaRad).toBeCloseTo(0, 6)
  const p = applySimilarity({x:5,y:0}, sim)
  expect(p.x).toBeCloseTo(10, 6)
  expect(p.y).toBeCloseTo(0, 6)
})

test('similarity rotation + translation', () => {
  const sim = computeSimilarity({
    base: [{x:10,y:10},{x:10,y:20}],
    overlay: [{x:0,y:0},{x:10,y:0}]
  })
  // overlay vector along +x maps to base vector along +y -> theta = 90deg
  expect(sim.thetaRad).toBeCloseTo(Math.PI/2, 4)
  const p = applySimilarity({x:0,y:0}, sim)
  // P1o -> P1b
  expect(p.x).toBeCloseTo(10, 4)
  expect(p.y).toBeCloseTo(10, 4)
})
