import { isOver, legalMoves, play, score, type Position } from './Board'
import { PolicyNet } from './PolicyNet'
type Action = number | 'pass'
type Node = { position: Position; parent?: Node; move?: Action; prior: number; visits: number; value: number; children: Node[] }

// Values are stored from the perspective of the player to move at each node.
// This makes the negation in PUCT and backpropagation explicit and consistent.
export function chooseMove(rootPosition: Position, policy: PolicyNet, simulations: number): Action | undefined {
  const root: Node = { position: rootPosition, prior: 1, visits: 0, value: 0, children: [] }
  for (let i = 0; i < simulations; i++) {
    let n = root
    const path: Node[] = [root]
    while (n.children.length && !isOver(n.position)) {
      n = select(n)
      path.push(n)
    }
    if (!isOver(n.position)) {
      expand(n, policy)
      if (n.children.length) {
        n = select(n)
        path.push(n)
      }
    }
    const result = rollout(n.position, rootPosition.toPlay, policy, i)
    for (const node of path) {
      node.visits++
      node.value += node.position.toPlay === rootPosition.toPlay ? result : -result
    }
  }
  return root.children
    .sort((a, b) => b.visits - a.visits || b.value - a.value)[0]?.move
}
function select(n: Node): Node {
  return n.children.reduce((a, b) => {
    const av = -a.value / (a.visits || 1) + 1.4 * a.prior * Math.sqrt(n.visits + 1) / (a.visits + 1)
    const bv = -b.value / (b.visits || 1) + 1.4 * b.prior * Math.sqrt(n.visits + 1) / (b.visits + 1)
    return av > bv ? a : b
  })
}

function expand(n: Node, policy: PolicyNet) {
  const p = policy.priors(n.position)
  const moves = legalMoves(n.position)
  n.children = [
    ...moves.map((m) => ({ position: play(n.position, { index: m })!, parent: n, move: m as Action, prior: p.get(m) ?? 0, visits: 0, value: 0, children: [] })),
    { position: play(n.position, { pass: true })!, parent: n, move: 'pass' as Action, prior: 0.01, visits: 0, value: 0, children: [] },
  ]
  const total = n.children.reduce((sum, child) => sum + child.prior, 0) || 1
  for (const child of n.children) child.prior /= total
  // AlphaZero-style root exploration. Noise is only used to choose the opening
  // and keeps the browser player's subsequent searches deterministic enough.
  if (!n.parent && n.children.length > 1) {
    const alpha = 0.3
    const noise = n.children.map(() => gammaSample(alpha))
    const noiseTotal = noise.reduce((a, b) => a + b, 0) || 1
    n.children.forEach((child, i) => { child.prior = child.prior * 0.75 + (noise[i] / noiseTotal) * 0.25 })
  }
}

function gammaSample(shape: number): number {
  let product = 1
  for (let i = 0; i < Math.ceil(shape); i++) product *= Math.random()
  return -Math.log(product || Number.MIN_VALUE)
}

// Lightly guided rollout: use policy occasionally (rather than every ply) and
// otherwise sample a small set, keeping the 10k-simulation difficulty usable.
function rollout(position: Position, perspective: 1 | 2, policy: PolicyNet, simulation: number): number {
  let p = position
  for (let i = 0; i < 28 && !isOver(p); i++) {
    const moves = legalMoves(p)
    if (!moves.length) { p = play(p, { pass: true })!; continue }
    let move: number
    if (simulation % 4 === 0 && i === 0) {
      const priors = policy.priors(p)
      const ranked = moves.slice().sort((a, b) => (priors.get(b) ?? 0) - (priors.get(a) ?? 0))
      // Randomise among the best few to retain rollout diversity.
      move = ranked[Math.floor(Math.random() * Math.min(5, ranked.length))]
    } else {
      move = moves[Math.floor(Math.random() * moves.length)]
    }
    p = play(p, { index: move })!
  }
  const s = score(p)
  const margin = perspective === 1 ? s.black - s.white : s.white - s.black
  return Math.tanh(margin / 4)
}
