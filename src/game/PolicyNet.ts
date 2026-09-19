import { NB, play, legalMoves, type Position } from './Board'
export const FDIM = 80
export type Weights = { weights?: number[][]; bias?: number[] }

type MoveAnalysis = {
  next: Position
  captures: number
  ownLiberties: number
  enemyAtari: number
  ownAtari: number
  connection: number
  selfAtari: boolean
}

function groupLiberties(position: Position, start: number): { size: number; liberties: number } {
  const color = position.stones[start]
  if (!color) return { size: 0, liberties: 0 }
  const seen = new Uint8Array(81), liberties = new Uint8Array(81), stack = [start]
  let size = 0, libertyCount = 0
  seen[start] = 1
  while (stack.length) {
    const point = stack.pop()!; size++
    for (const n of NB[point]) {
      if (position.stones[n] === 0 && !liberties[n]) { liberties[n] = 1; libertyCount++ }
      else if (position.stones[n] === color && !seen[n]) { seen[n] = 1; stack.push(n) }
    }
  }
  return { size, liberties: libertyCount }
}

function analyzeMove(position: Position, move: number, next = play(position, { index: move })!): MoveAnalysis {
  const opponent = 3 - position.toPlay
  let captures = 0, enemyAtari = 0, ownAtari = 0, connection = 0
  for (const n of NB[move]) {
    if (position.stones[n] === position.toPlay) {
      connection++
      if (groupLiberties(position, n).liberties === 1) ownAtari++
    } else if (position.stones[n] === opponent && groupLiberties(position, n).liberties === 1) enemyAtari++
  }
  for (let i = 0; i < 81; i++) if (position.stones[i] === opponent && next.stones[i] === 0) captures++
  const own = groupLiberties(next, move)
  return { next, captures, ownLiberties: own.liberties, enemyAtari, ownAtari, connection, selfAtari: captures === 0 && own.liberties <= 1 }
}

// AI/ML: 80 engineered features. The first 50 remain compatible with policy files;
// the remaining slots describe tactical shape and move quality.
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
  if (next) {
    const a = analyzeMove(position, move, next)
    f[59] = Math.min(a.captures, 4) / 4
    f[60] = Math.min(a.enemyAtari, 2) / 2
    f[61] = Math.min(a.ownAtari, 2) / 2
    f[62] = Math.min(a.ownLiberties, 4) / 4
    f[63] = Math.min(a.connection, 4) / 4
    f[64] = a.selfAtari ? 1 : 0
    f[65] = Math.min(a.ownLiberties, 8) / 8
    f[66] = (a.captures + a.enemyAtari * 0.5) / 3
  }
  return f
}
export class PolicyNet {
  private weights: Weights
  constructor(weights: Weights = {}) { this.weights = weights }
  getWeights(): Weights { return this.weights }
  priors(position: Position): Map<number, number> {
    const moves = legalMoves(position), logits = moves.map((m) => {
      const f = features(position, m), w = this.weights.weights?.[0] ?? [], b = this.weights.bias?.[0] ?? 0
      // Tactical terms are deliberately outside the learned vector so an empty
      // or old policy file still plays sensible 9x9 Go.
      const tactical = f[59] * 2.4 + f[60] * 1.5 + f[61] * 0.9 + f[62] * 0.32 + f[63] * 0.55 - f[64] * 2.8
      return f.reduce((sum, x, i) => sum + x * (w[i] ?? 0), b) + tactical + (Math.abs((m % 9) - 4) + Math.abs(Math.floor(m / 9) - 4)) * -0.04
    })
    const max = Math.max(...logits), exps = logits.map((x) => Math.exp(x - max)), total = exps.reduce((a, b) => a + b, 0) || 1
    return new Map(moves.map((m, i) => [m, exps[i] / total]))
  }
}
export async function loadPolicy(): Promise<PolicyNet> { try { const r = await fetch('/policy9.json'); return new PolicyNet(await r.json()) } catch { return new PolicyNet() } }
