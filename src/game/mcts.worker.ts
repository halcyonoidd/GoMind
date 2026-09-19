import { chooseMove } from './MCTS'
import { PolicyNet } from './PolicyNet'
import type { Position } from './Board'

type Request = { position: Position; simulations: number; weights: { weights?: number[][]; bias?: number[] } }

self.onmessage = (event: MessageEvent<Request>) => {
  const { position, simulations, weights } = event.data
  const move = chooseMove(position, new PolicyNet(weights), simulations)
  self.postMessage(move)
}
