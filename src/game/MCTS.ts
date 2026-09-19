import { isOver, legalMoves, play, score, type Position } from './Board'
import { PolicyNet } from './PolicyNet'
type Node = { position: Position; parent?: Node; move?: number; prior: number; visits: number; value: number; children: Node[] }
// Search Algorithm: Select/Expand/Rollout/Backprop with PUCT C=1.4.
export function chooseMove(rootPosition: Position, policy: PolicyNet, simulations: number): number | undefined {
  const root: Node = { position: rootPosition, prior: 1, visits: 0, value: 0, children: [] }
  for (let i = 0; i < simulations; i++) {
    let n = root
    while (n.children.length && !isOver(n.position)) n = select(n)
    if (!isOver(n.position)) expand(n, policy)
    // A newly expanded node is evaluated from one of its children. Cycling
    // through children avoids giving the first legal move a rollout bias.
    const child = n.children.length ? n.children[i % n.children.length] : undefined
    const result = rollout(child?.position ?? n.position, rootPosition.toPlay, policy, i)
    for (let x: Node | undefined = n; x; x = x.parent) { x.visits++; x.value += result }
  }
  return root.children.sort((a, b) => b.visits - a.visits)[0]?.move
}
function select(n: Node): Node {
  return n.children.reduce((a, b) => {
    const av = -a.value / (a.visits || 1) + 1.4 * a.prior * Math.sqrt(n.visits + 1) / (a.visits + 1)
    const bv = -b.value / (b.visits || 1) + 1.4 * b.prior * Math.sqrt(n.visits + 1) / (b.visits + 1)
    return av > bv ? a : b
  })
}
function expand(n: Node, policy: PolicyNet) { const p = policy.priors(n.position); n.children = legalMoves(n.position).map((m) => ({ position: play(n.position, { index: m })!, parent: n, move: m, prior: p.get(m) ?? 0, visits: 0, value: 0, children: [] })) }
// Lightly guided rollout: use policy occasionally (rather than every ply) and
// otherwise sample a small set, keeping the 10k-simulation difficulty usable.
function rollout(position: Position, perspective: 1 | 2, policy: PolicyNet, simulation: number): number {
  let p = position
  for (let i = 0; i < 28 && !isOver(p); i++) {
    const moves = legalMoves(p)
    if (!moves.length) break
    let move: number
    if (simulation % 24 === 0 && i === 0) {
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
