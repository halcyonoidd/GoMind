import { useEffect, useState } from 'react'
import { initialPosition, isOver, play, score, SIZE, winner, type Color, type Position } from './game/Board'
import { chooseMove } from './game/MCTS'
import { loadPolicy, PolicyNet } from './game/PolicyNet'
import './App.css'

const SIMS = { Casual: 200, Club: 800, Pro: 2400 }
type Difficulty = keyof typeof SIMS

export default function Home() {
  const [position, setPosition] = useState<Position>(initialPosition)
  const [past, setPast] = useState<Position[]>([])
  const [policy, setPolicy] = useState<PolicyNet>()
  const [human, setHuman] = useState<Color>(1)
  const [difficulty, setDifficulty] = useState<Difficulty>('Casual')
  const [thinking, setThinking] = useState(false)
  useEffect(() => { loadPolicy().then(setPolicy) }, [])
  useEffect(() => {
    if (!policy || isOver(position) || position.toPlay === human) return
    setThinking(true)
    const timer = window.setTimeout(() => { const move = chooseMove(position, policy, SIMS[difficulty]); if (move !== undefined) { setPast((p) => [...p, position]); setPosition(play(position, { index: move })!) }; setThinking(false) }, 50)
    return () => window.clearTimeout(timer)
  }, [position, policy, human, difficulty])
  const place = (index: number) => { if (!thinking && !isOver(position) && position.toPlay === human) { const next = play(position, { index }); if (next) { setPast([...past, position]); setPosition(next) } } }
  const pass = () => { if (thinking || isOver(position) || position.toPlay !== human) return; const next = play(position, { pass: true }); if (next) { setPast([...past, position]); setPosition(next) } }
  const undo = () => { const previous = past[past.length - 1]; if (previous) { setPast(past.slice(0, -1)); setPosition(previous) } }
  const reset = () => { setPast([]); setPosition(initialPosition()) }
  const points = score(position), win = points.black - points.white
  const humanScore = human === 1 ? points.black : points.white
  const aiScore = human === 1 ? points.white : points.black
  const gameStatus = isOver(position)
    ? winner(position) === human ? 'Kamu menang!' : winner(position) === 0 ? 'Permainan seri' : 'GoMind menang'
    : humanScore > aiScore ? 'Kamu menang!'
      : humanScore < aiScore ? 'GoMind menang'
        : thinking ? 'Thinking…'
          : position.toPlay === human ? 'Your turn' : 'GoMind'
  return <main className="home">
    <header className="topbar"><div className="brand"><span className="brand-mark">✦</span>GoMind</div><span className="tag">9 × 9 • GO AI</span><button className="ghost" onClick={reset}>New Game</button></header>
    <section className="hero-copy"><p className="eyebrow">A quiet board. A curious machine.</p><h1>Find your <em>liberties.</em></h1><p className="lede">A browser-native Go opponent using engineered policy features and PUCT search. Capture stones, protect your groups, and score territory.</p></section>
    <section className="game-layout"><div className="board-wrap">
      <div className="board-title"><span>YOU PLAY <b>{human === 1 ? 'BLACK' : 'WHITE'}</b></span><span className="status">{gameStatus}</span></div>
      <svg className="board" role="grid" aria-label="9 by 9 Go board" viewBox="0 0 900 900"><defs><radialGradient id="blackStone" cx="35%" cy="30%"><stop offset="0%" stopColor="#68706c" /><stop offset="45%" stopColor="#262a28" /><stop offset="100%" stopColor="#111412" /></radialGradient><radialGradient id="whiteStone" cx="35%" cy="30%"><stop offset="0%" stopColor="#ffffff" /><stop offset="70%" stopColor="#f6f1e6" /><stop offset="100%" stopColor="#c7baa0" /></radialGradient></defs>{Array.from({ length: SIZE }, (_, i) => <g key={`l${i}`}><line x1={50 + i * 100} y1="50" x2={50 + i * 100} y2="850" /><line x1="50" y1={50 + i * 100} x2="850" y2={50 + i * 100} /></g>)}{Array.from({ length: 81 }, (_, i) => { const stone = position.stones[i]; return <g key={i} role="gridcell" tabIndex={stone ? -1 : 0} onClick={() => place(i)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && place(i)}><circle className="hit-area" cx={50 + (i % 9) * 100} cy={50 + Math.floor(i / 9) * 100} r="44" />{stone !== 0 && <circle className={`stone ${stone === 1 ? 'black' : 'white'}`} cx={50 + (i % 9) * 100} cy={50 + Math.floor(i / 9) * 100} r="34" />}{position.lastMove === i && <circle className="last-move" cx={50 + (i % 9) * 100} cy={50 + Math.floor(i / 9) * 100} r="8" />}</g>})}</svg>
      <div className="board-footer"><button className="side-button" onClick={pass}>Pass</button><button className="side-button" onClick={undo} disabled={!past.length}>Undo</button><span className="score">B {points.black.toFixed(1)} · W {points.white.toFixed(1)}</span></div>
    </div><aside className="info-card"><div className="card-label">ENGINE CONTROLS</div><h2>Read the board.<br /><em>Shape the game.</em></h2><label>Difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>{Object.keys(SIMS).map((d) => <option key={d}>{d}</option>)}</select></label><label>Player color<select value={human} onChange={(e) => { setHuman(Number(e.target.value) as Color); reset() }}><option value="1">Black</option><option value="2">White</option></select></label><div className="winbar"><span>Win-rate signal</span><b>{Math.max(0, Math.min(100, 50 + win * 4)).toFixed(0)}%</b><i style={{ width: `${Math.max(0, Math.min(100, 50 + win * 4))}%` }} /></div><p>Chinese area scoring · 6.5 komi · Ko and suicide enforced locally.</p></aside></section>
    <footer><span>GoMind / Browser AI experiment</span><span>AI/ML <b>•</b> Search Algorithm</span></footer>
  </main>
}
