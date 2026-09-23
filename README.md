# GoMind

GoMind is a browser-based 9×9 Go player. The rules engine is in
`src/game/Board.ts`; the UI sends positions to a worker so MCTS does not block
the page.

## Development

```bash
npm install
npm run dev
npm run build
npm run lint
```

