// Tiny dependency-free policy trainer. It creates games with a tactical
// self-play policy, then fits an 80 -> 32 -> 1 ReLU network with SGD.
import { mkdir, writeFile } from 'node:fs/promises'

const N = 9, SIZE = 81, rand = (() => { let s = 0x9e3779b9; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000 } })()
const neighbors = Array.from({ length: SIZE }, (_, p) => {
  const r = Math.floor(p / N), c = p % N
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([y, x]) => y >= 0 && y < N && x >= 0 && x < N).map(([y, x]) => y * N + x)
})
function group(board, start) {
  const color = board[start], seen = new Set([start]), stones = [], liberties = new Set(), todo = [start]
  while (todo.length) { const p = todo.pop(); stones.push(p); for (const q of neighbors[p]) if (!board[q]) liberties.add(q); else if (board[q] === color && !seen.has(q)) { seen.add(q); todo.push(q) } }
  return { stones, liberties }
}
function play(board, toPlay, move) {
  if (board[move]) return null
  const next = board.slice(); next[move] = toPlay; const enemy = 3 - toPlay
  for (const q of neighbors[move]) if (next[q] === enemy) { const g = group(next, q); if (!g.liberties.size) for (const p of g.stones) next[p] = 0 }
  if (!group(next, move).liberties.size) return null
  return next
}
function features(board, toPlay, move) {
  const f = Array(80).fill(0), r = Math.floor(move / N), c = move % N
  f[0] = r / 8; f[1] = c / 8; f[2] = r === 0 || r === 8; f[3] = c === 0 || c === 8; f[4] = f[2] && f[3]
  let own = 0, enemy = 0, empty = 0
  for (const q of neighbors[move]) { own += board[q] === toPlay; enemy += board[q] === 3 - toPlay; empty += !board[q] }
  f[5] = own / 4; f[6] = enemy / 4; f[7] = empty / 4
  const next = play(board, toPlay, move); let captures = 0
  if (next) for (let i = 0; i < SIZE; i++) captures += board[i] === 3 - toPlay && !next[i]
  f[59] = Math.min(captures, 4) / 4
  if (next) { const g = group(next, move); f[62] = Math.min(g.liberties.size, 4) / 4; f[64] = g.liberties.size <= 1 && !captures ? 1 : 0 }
  for (let i = 0; i < SIZE; i++) { f[41 + i % 9] += board[i] === toPlay ? 1 / 81 : 0; f[50 + i % 9] += board[i] === 3 - toPlay ? 1 / 81 : 0 }
  return f
}
function legal(board, color) { return board.map((v, i) => !v && play(board, color, i) ? i : -1).filter(i => i >= 0) }
function scoreMove(board, color, move) { const f = features(board, color, move); return f[59] * 7 + f[62] * .4 - f[64] * 4 + (rand() - .5) * .2 }
const samples = []
for (let game = 0; game < 80; game++) {
  let board = Array(SIZE).fill(0), color = 1
  for (let turn = 0; turn < 55; turn++) {
    const moves = legal(board, color); if (!moves.length) break
    const ranked = moves.slice().sort((a, b) => scoreMove(board, color, b) - scoreMove(board, color, a))
    const move = ranked[Math.floor(Math.pow(rand(), 1.8) * Math.min(8, ranked.length))]
    samples.push({ x: features(board, color, move), board: board.slice(), color, move })
    board = play(board, color, move); color = 3 - color
    if (rand() < .04) break
  }
}
const H = 32, w1 = Array.from({ length: H }, () => Array.from({ length: 80 }, () => (rand() - .5) * .12)), b1 = Array(H).fill(0)
const w2 = [Array.from({ length: H }, () => (rand() - .5) * .12)], b2 = [0]
function forward(x) { const h = b1.map((b, j) => Math.max(0, b + w1[j].reduce((s, w, i) => s + w * x[i], 0))); return { h, y: b2[0] + w2[0].reduce((s, w, i) => s + w * h[i], 0) } }
for (let epoch = 0; epoch < 14; epoch++) for (const sample of samples) {
  const moves = legal(sample.board, sample.color), out = moves.map(m => forward(features(sample.board, sample.color, m))), max = Math.max(...out.map(o => o.y)), exps = out.map(o => Math.exp(o.y - max)), total = exps.reduce((a, b) => a + b, 0)
  const probs = exps.map(e => e / total), target = moves.indexOf(sample.move)
  const dh = Array(H).fill(0)
  for (let k = 0; k < moves.length; k++) { const grad = probs[k] - (k === target ? 1 : 0); for (let j = 0; j < H; j++) { dh[j] += grad * w2[0][j]; w2[0][j] -= .035 * grad * out[k].h[j] } b2[0] -= .035 * grad }
  const h = forward(sample.x).h
  for (let j = 0; j < H; j++) if (h[j] > 0) { for (let i = 0; i < 80; i++) w1[j][i] -= .035 * dh[j] * sample.x[i]; b1[j] -= .035 * dh[j] }
}
await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(new URL('../public/policy9.json', import.meta.url), JSON.stringify({ version: 2, inputSize: 80, layers: [{ weights: w1, bias: b1 }, { weights: w2, bias: b2 }] }))
console.log(`trained ${samples.length} self-play positions`)
