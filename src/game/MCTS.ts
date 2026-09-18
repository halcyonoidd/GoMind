import { isOver, legalMoves, play, score, type Position } from './Board'
import { PolicyNet } from './PolicyNet'
type Node = { position: Position; parent?: Node; move?: number; prior: number; visits: number; value: number; children: Node[] }
// Search Algorithm: Select/Expand/Rollout/Backprop with PUCT C=1.4.
export function chooseMove(rootPosition: Position, policy: PolicyNet, simulations: number): number | undefined {
  const root: Node = { position: rootPosition, prior: 1, visits: 0, value: 0, children: [] }
  for (let i = 0; i < simulations; i++) { let n = root; while (n.children.length && !isOver(n.position)) n = select(n); if (!isOver(n.position)) expand(n, policy); const result = rollout(n.children[0]?.position ?? n.position, rootPosition.toPlay, policy); for (let x: Node | undefined = n; x; x = x.parent) { x.visits++; x.value += result } }
  return root.children.sort((a, b) => b.visits - a.visits)[0]?.move
}
function select(n: Node): Node { return n.children.reduce((a, b) => (-a.value / (a.visits || 1) + 1.4 * a.prior * Math.sqrt(n.visits + 1) / (a.visits + 1)) > (-b.value / (b.visits || 1) + 1.4 * b.prior * Math.sqrt(n.visits + 1) / (b.visits + 1)) ? a : b) }
function expand(n: Node, policy: PolicyNet) { const p = policy.priors(n.position); n.children = legalMoves(n.position).map((m) => ({ position: play(n.position, { index: m })!, parent: n, move: m, prior: p.get(m) ?? 0, visits: 0, value: 0, children: [] })) }
function rollout(position: Position, perspective: 1 | 2, policy: PolicyNet): number { let p = position; for (let i = 0; i < 40 && !isOver(p); i++) { const ms = legalMoves(p); if (!ms.length) break; const priors = policy.priors(p); ms.sort((a, b) => (priors.get(b) ?? 0) - (priors.get(a) ?? 0)); p = play(p, { index: ms[Math.random() < .8 ? 0 : Math.floor(Math.random() * ms.length)] })! } const s = score(p); return (perspective === 1 ? s.black - s.white : s.white - s.black) > 0 ? 1 : -1 }
