export const SIZE = 9
export const KOMI = 6.5
export type Stone = 0 | 1 | 2 // 0 empty, 1 black, 2 white
export type Color = 1 | 2
export type Move = { index: number } | { pass: true }

// Rules engine: fixed neighbour table keeps browser play allocation-free.
export const NB: readonly number[][] = Array.from({ length: SIZE * SIZE }, (_, i) => {
  const r = Math.floor(i / SIZE), c = i % SIZE
  return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
    .filter(([y, x]) => y >= 0 && y < SIZE && x >= 0 && x < SIZE).map(([y, x]) => y * SIZE + x)
})

export type Position = { stones: Int8Array; toPlay: Color; ko: number; consecutivePasses: number; history: Int8Array[]; lastMove?: number }

export function initialPosition(): Position {
  return { stones: new Int8Array(SIZE * SIZE), toPlay: 1, ko: -1, consecutivePasses: 0, history: [] }
}

function group(stones: Int8Array, start: number): { stones: number[]; liberties: Set<number> } {
  const color = stones[start], seen = new Uint8Array(stones.length), stack = [start], members: number[] = [], liberties = new Set<number>()
  seen[start] = 1
  while (stack.length) {
    const p = stack.pop()!; members.push(p)
    for (const n of NB[p]) {
      if (stones[n] === 0) liberties.add(n)
      else if (stones[n] === color && !seen[n]) { seen[n] = 1; stack.push(n) }
    }
  }
  return { stones: members, liberties }
}

export function play(position: Position, move: Move): Position | null {
  if ('pass' in move) return { ...position, toPlay: (3 - position.toPlay) as Color, ko: -1, consecutivePasses: position.consecutivePasses + 1, history: [...position.history, position.stones.slice()] }
  const p = move.index
  if (p < 0 || p >= 81 || position.stones[p] !== 0 || p === position.ko) return null
  const stones = position.stones.slice(); stones[p] = position.toPlay
  const opponent = (3 - position.toPlay) as Color; const captured: number[] = []
  for (const n of NB[p]) if (stones[n] === opponent) {
    const g = group(stones, n)
    if (!g.liberties.size) for (const s of g.stones) { stones[s] = 0; captured.push(s) }
  }
  const own = group(stones, p)
  if (!own.liberties.size) return null
  const ko = captured.length === 1 && own.stones.length === 1 && own.liberties.size === 1 ? captured[0] : -1
  return { stones, toPlay: opponent, ko, consecutivePasses: 0, history: [...position.history, position.stones.slice()], lastMove: p }
}

export function legalMoves(position: Position): number[] {
  const moves: number[] = []
  for (let i = 0; i < 81; i++) if (play(position, { index: i })) moves.push(i)
  return moves
}

export function isOver(position: Position): boolean { return position.consecutivePasses >= 2 }

export function score(position: Position): { black: number; white: number } {
  const seen = new Uint8Array(81); let black = 0, white = KOMI
  for (let i = 0; i < 81; i++) {
    if (position.stones[i] === 1) black++
    else if (position.stones[i] === 2) white++
    else if (!seen[i]) {
      const area = group(position.stones.map((s, n) => s || (n === i ? 0 : 0)) as Int8Array, i)
      const region = area.stones, borders = new Set<number>()
      region.forEach((p) => NB[p].forEach((n) => position.stones[n] && borders.add(position.stones[n])))
      region.forEach((p) => { seen[p] = 1 })
      if (borders.size === 1) borders.has(1) ? black += region.length : white += region.length
    }
  }
  return { black, white }
}

export function winner(position: Position): Color | 0 { const s = score(position); return s.black > s.white ? 1 : s.white > s.black ? 2 : 0 }
