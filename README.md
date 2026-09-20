# GoMind

GoMind is a browser-based 9×9 Go player. The rules engine is in
`src/game/Board.ts`; the UI sends positions to a worker so MCTS does not block
the page.

## Architecture

`PolicyNet` evaluates each legal move from 80 engineered board/move features.
The checked-in `public/policy9.json` is a small dense MLP (80 → 32 ReLU → 1
logit). Logits are softmaxed over legal moves and used as priors by
AlphaZero-style PUCT. The root mixes those priors with Dirichlet-like
exploration noise. Rollouts remain deliberately lightweight so the four UI
difficulty levels are usable in a browser.

Older policy files containing `weights` and `bias` (a single linear layer) are
still accepted by `PolicyNet`; replacing the file is therefore optional when
developing a compatible model.

## Development

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Training a policy

The dependency-free `scripts/train-policy.mjs` generates short tactical
self-play games, records the positions and selected moves, trains the same
80 → 32 → 1 network with SGD, and writes `public/policy9.json`:

```bash
npm run train:policy
```

This is an educational bootstrap trainer, not a professional Go engine:
games use a small tactical rollout policy, there is no value head, symmetry
augmentation, or strong external-game dataset, and the resulting policy can
overfit its generated games. For stronger play, increase self-play games and
training epochs or replace the script with a stronger data source while
preserving the JSON layer format.
