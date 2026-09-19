import { useEffect, useState } from 'react'
import { initialPosition, isOver, legalMoves, play, score, SIZE, winner, type Color, type Position } from './game/Board'
import { loadPolicy, PolicyNet } from './game/PolicyNet'
import './App.css'

const SIMS = { Baby: 500, Human: 1500, Einstein: 5000, Monster: 10000 }
type Difficulty = keyof typeof SIMS

export default function Home() {
  const [position, setPosition] = useState<Position>(initialPosition)
  const [past, setPast] = useState<Position[]>([])
  const [policy, setPolicy] = useState<PolicyNet>()
  const [human, setHuman] = useState<Color>(1)
  const [difficulty, setDifficulty] = useState<Difficulty>('Baby')
  const [thinking, setThinking] = useState(false)
  useEffect(() => { loadPolicy().then(setPolicy) }, [])
  const noLegalMoves = legalMoves(position).length === 0
  const gameFinished = isOver(position) || noLegalMoves
  useEffect(() => {
    if (!policy || gameFinished || position.toPlay === human) return
    setThinking(true)
    const worker = new Worker(new URL('./game/mcts.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<number | undefined>) => {
      if (event.data !== undefined) {
        setPast((p) => [...p, position])
        setPosition((current) => play(current, { index: event.data! }) ?? current)
      }
      setThinking(false)
      worker.terminate()
    }
    worker.onerror = () => { setThinking(false); worker.terminate() }
    worker.postMessage({ position, simulations: SIMS[difficulty], weights: policy.getWeights() })
    return () => worker.terminate()
  }, [position, policy, human, difficulty, gameFinished])
  const place = (index: number) => { if (!thinking && !gameFinished && position.toPlay === human) { const next = play(position, { index }); if (next) { setPast([...past, position]); setPosition(next) } } }
  const pass = () => { if (thinking || gameFinished || position.toPlay !== human) return; const next = play(position, { pass: true }); if (next) { setPast([...past, position]); setPosition(next) } }
  const undo = () => { const previous = past[past.length - 1]; if (previous) { setPast(past.slice(0, -1)); setPosition(previous) } }
  const reset = () => { setPast([]); setPosition(initialPosition()) }
  const points = score(position), win = points.black - points.white
  const gameWinner = winner(position)
  const gameStatus = gameFinished
    ? gameWinner === human ? 'Game Over — You Win!'
      : gameWinner === 0 ? 'Game Over — Tie'
        : 'Game Over — GoMind Wins'
    : thinking ? 'GoMind is thinking…'
      : position.toPlay === human ? 'Your Turn' : 'GoMind\'s Turn'
  return <main className="home">
    <header className="topbar"><div className="brand"><span className="brand-mark"></span>GoMind</div><span className="tag">9 × 9 • GO ML</span><button className="ghost" onClick={reset}>New Game</button></header>
    <section className="hero-copy"></section>
    <section className="game-layout"><div className="board-wrap">
      <div className="board-title"><span>YOU PLAY <b>{human === 1 ? 'BLACK' : 'WHITE'}</b></span><span className="status">{gameStatus}</span></div>
      <svg className="board" role="grid" aria-label="9 by 9 Go board" viewBox="0 0 900 900"><defs><radialGradient id="blackStone" cx="35%" cy="30%"><stop offset="0%" stopColor="#68706c" /><stop offset="45%" stopColor="#262a28" /><stop offset="100%" stopColor="#111412" /></radialGradient><radialGradient id="whiteStone" cx="35%" cy="30%"><stop offset="0%" stopColor="#ffffff" /><stop offset="70%" stopColor="#f6f1e6" /><stop offset="100%" stopColor="#c7baa0" /></radialGradient></defs>{Array.from({ length: SIZE }, (_, i) => <text className="coordinate" key={`top-${i}`} x={50 + i * 100} y="28" textAnchor="middle">{'ABCDEFGHJ'[i]}</text>)}{Array.from({ length: SIZE }, (_, i) => <text className="coordinate" key={`side-${i}`} x="25" y={55 + i * 100} textAnchor="middle">{SIZE - i}</text>)}{Array.from({ length: SIZE }, (_, i) => <g key={`l${i}`}><line x1={50 + i * 100} y1="50" x2={50 + i * 100} y2="850" /><line x1="50" y1={50 + i * 100} x2="850" y2={50 + i * 100} /></g>)}{Array.from({ length: 81 }, (_, i) => { const stone = position.stones[i]; return <g key={i} role="gridcell" tabIndex={stone ? -1 : 0} onClick={() => place(i)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && place(i)}><circle className="hit-area" cx={50 + (i % 9) * 100} cy={50 + Math.floor(i / 9) * 100} r="44" />{stone !== 0 && <circle className={`stone ${stone === 1 ? 'black' : 'white'}`} cx={50 + (i % 9) * 100} cy={50 + Math.floor(i / 9) * 100} r="34" />}{position.lastMove === i && <circle className="last-move" cx={50 + (i % 9) * 100} cy={50 + Math.floor(i / 9) * 100} r="8" />}</g>})}</svg>
      <div className="board-footer"><button className="side-button" onClick={pass}>Pass</button><button className="side-button" onClick={undo} disabled={!past.length}>Undo</button><span className="score">B {points.black.toFixed(1)} · W {points.white.toFixed(1)}<br />Black captured {position.captures.black} white stones · White captured {position.captures.white} black stones</span></div>
    </div><aside className="info-card"><div className="card-label">GAME SETUP</div><h2>Pick a level, pick a side.<br /><em>Then watch it think.</em></h2><label>Difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>{Object.keys(SIMS).map((d) => <option key={d}>{d}</option>)}</select></label><label>Pick your stones<select value={human} onChange={(e) => { setHuman(Number(e.target.value) as Color); reset() }}><option value="1">Black</option><option value="2">White</option></select></label><div className="winbar"><span>Win-rate signal</span><b>{Math.max(0, Math.min(100, 50 + win * 4)).toFixed(0)}%</b><i style={{ width: `${Math.max(0, Math.min(100, 50 + win * 4))}%` }} /></div></aside></section>
    <footer><span>GoMind</span><span>Machine Learning</span></footer>
  </main>
}
