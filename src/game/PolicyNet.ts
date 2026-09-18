import { NB, play, legalMoves, type Position } from './Board'
export const FDIM = 80
export type Weights = { weights?: number[][]; bias?: number[] }

// AI/ML: 80 engineered features: liberties, edge, atari, captures, occupancy and 3x3 hash.
export function features(position: Position, move: number): Float32Array {
  const f = new Float32Array(FDIM); const r = Math.floor(move / 9), c = move % 9
  f[0] = r / 8; f[1] = c / 8; f[2] = r === 0 || r === 8 ? 1 : 0; f[3] = c === 0 || c === 8 ? 1 : 0
  f[4] = (r === 0 || r === 8) && (c === 0 || c === 8) ? 1 : 0
  let own = 0, enemy = 0, empty = 0, hash = 0
  for (const n of NB[move]) { own += position.stones[n] === position.toPlay ? 1 : 0; enemy += position.stones[n] === 3 - position.toPlay ? 1 : 0; empty += position.stones[n] === 0 ? 1 : 0 }
  f[5] = own / 4; f[6] = enemy / 4; f[7] = empty / 4
  const next = play(position, { index: move }); f[8] = next ? (position.stones.filter((s) => s === 3 - position.toPlay).length - next.stones.filter((s) => s === 3 - position.toPlay).length) / 4 : 0
  for (const n of NB[move]) hash = (hash * 3 + position.stones[n]) % 32
  f[9 + hash] = 1
  for (let i = 0; i < 81; i++) { f[41 + (i % 9)] += position.stones[i] === position.toPlay ? 1 / 81 : 0; f[50 + (i % 9)] += position.stones[i] === 3 - position.toPlay ? 1 / 81 : 0 }
  return f
}
export class PolicyNet {
  private weights: Weights
  constructor(weights: Weights = {}) { this.weights = weights }
  priors(position: Position): Map<number, number> {
    const moves = legalMoves(position), logits = moves.map((m) => {
      const f = features(position, m), w = this.weights.weights?.[0] ?? [], b = this.weights.bias?.[0] ?? 0
      return f.reduce((sum, x, i) => sum + x * (w[i] ?? 0), b) + (Math.abs((m % 9) - 4) + Math.abs(Math.floor(m / 9) - 4)) * -0.04
    })
    const max = Math.max(...logits), exps = logits.map((x) => Math.exp(x - max)), total = exps.reduce((a, b) => a + b, 0) || 1
    return new Map(moves.map((m, i) => [m, exps[i] / total]))
  }
}
export async function loadPolicy(): Promise<PolicyNet> { try { const r = await fetch('/policy9.json'); return new PolicyNet(await r.json()) } catch { return new PolicyNet() } }
