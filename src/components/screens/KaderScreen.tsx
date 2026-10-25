import { motion, AnimatePresence } from 'framer-motion'
import { useKader } from '../../game/useKader'
import { CARD_META, type KaderCard } from '../../game/kader'

interface Props {
  onExit: () => void
}

const TONE: Record<string, string> = {
  good: 'border-signal/40 bg-signal/15 text-signal',
  wild: 'border-ice/40 bg-ice/15 text-ice',
  bad: 'border-danger/40 bg-danger/15 text-danger',
  rare: 'border-amber/40 bg-amber/15 text-amber',
}

function CardChip({ card, pulse }: { card: KaderCard; pulse?: boolean }) {
  const meta = CARD_META[card]
  return (
    <motion.div
      layout
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: pulse ? 1.06 : 1, opacity: 1 }}
      className={`rounded-2xl border px-3 py-2 text-center backdrop-blur-md ${TONE[meta.tone]}`}
    >
      <p className="font-display text-lg leading-none tracking-wide">
        {meta.label}
      </p>
      <p className="mt-1 text-[10px] opacity-80">{meta.hint}</p>
    </motion.div>
  )
}

export function KaderScreen({ onExit }: Props) {
  const k = useKader()
  const canSpin = k.phase === 'idle' || k.phase === 'choice'
  const canLock = k.phase === 'choice' && k.links.length > 0
  const ended = k.phase === 'locked' || k.phase === 'crashed'

  return (
    <div className="relative z-30 flex h-full flex-col bg-[radial-gradient(ellipse_at_50%_0%,#132a45_0%,#061018_55%,#03080e_100%)]">
      <header className="shrink-0 px-4 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl border border-white/15 px-3 py-2 text-xs text-fog"
          >
            ← Uçuş
          </button>
          <div className="text-center">
            <p className="font-display text-2xl leading-none text-white">
              KADER
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.28em] text-amber">
              Makara · demo
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-1.5 text-right">
            <p className="text-[9px] uppercase text-fog">Rekor</p>
            <p className="font-display text-sm text-ice">{k.fmtMult(k.best)}</p>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-fog">{k.demoNote}</p>
      </header>

      {/* Chain stage */}
      <div className="relative min-h-0 flex-1 px-4 py-3">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-fog">
              Zincir
            </p>
            <motion.p
              key={k.multiplier}
              initial={{ scale: 1.15, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-display text-[clamp(2.6rem,12vw,3.75rem)] leading-none text-signal"
            >
              {k.fmtMult(k.multiplier)}
            </motion.p>
          </div>
          <div className="text-right text-xs text-fog">
            <p>{k.links.length} halka</p>
            <p className="text-amber">
              {k.shields > 0 ? `Kalkan ×${k.shields}` : 'Kalkan yok'}
            </p>
          </div>
        </div>

        <div className="flex min-h-[7.5rem] flex-wrap content-start gap-2 overflow-y-auto pb-2">
          <AnimatePresence initial={false}>
            {k.links.map((link, i) => (
              <motion.div
                key={link.id}
                initial={{ x: -12, opacity: 0 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative"
              >
                {i > 0 && (
                  <span
                    className="absolute -left-1.5 top-1/2 h-0.5 w-1.5 -translate-y-1/2 bg-white/25"
                    aria-hidden
                  />
                )}
                <div
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    TONE[CARD_META[link.card].tone]
                  }`}
                >
                  {CARD_META[link.card].label}
                  <span className="ml-1 opacity-70">
                    {link.delta >= 0 ? '+' : ''}
                    {link.delta.toFixed(2)}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {k.links.length === 0 && k.phase !== 'spinning' && (
            <p className="w-full self-center text-center text-sm text-fog/80">
              Spin ile ilk halkayı ekle — istediğin an kilitle.
            </p>
          )}
        </div>

        <div className="mt-2 flex min-h-[5.5rem] items-center justify-center">
          <AnimatePresence mode="wait">
            {k.phase === 'spinning' && k.spinningCard && (
              <motion.div
                key="spin"
                initial={{ rotate: -8, scale: 0.85, opacity: 0 }}
                animate={{ rotate: [0, 6, -4, 0], scale: 1, opacity: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.85 }}
                className="w-full max-w-[14rem]"
              >
                <CardChip card={k.spinningCard} pulse />
              </motion.div>
            )}
            {k.phase === 'break' && (
              <motion.div
                key="break"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full text-center"
              >
                <p className="font-display text-xl text-amber">KIRIK HALKA</p>
                <p className="mt-1 text-xs text-fog">
                  Baş mı son mu? {(k.breakMsLeft / 1000).toFixed(1)}s
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => k.keepBreak('head')}
                    className="rounded-xl border border-ice/35 bg-ice/15 py-3 text-sm font-semibold text-ice"
                  >
                    Başı tut
                  </button>
                  <button
                    type="button"
                    onClick={() => k.keepBreak('tail')}
                    className="rounded-xl border border-signal/35 bg-signal/15 py-3 text-sm font-semibold text-signal"
                  >
                    Sonu tut
                  </button>
                </div>
              </motion.div>
            )}
            {ended && k.result && (
              <motion.div
                key="end"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full rounded-2xl border border-white/12 bg-black/40 px-4 py-4 text-center backdrop-blur-md"
              >
                <p
                  className={`font-display text-2xl ${
                    k.result.outcome === 'locked' ? 'text-signal' : 'text-danger'
                  }`}
                >
                  {k.result.outcome === 'locked' ? 'KİLİTLENDİ' : 'ÇÖKTÜ'}
                </p>
                <p className="mt-1 font-display text-4xl text-white">
                  {k.fmtMult(k.result.multiplier)}
                </p>
                <p className="mt-1 text-xs text-fog">
                  {k.result.links} halka · demo skor
                </p>
              </motion.div>
            )}
            {k.phase === 'choice' && k.lastCard && !ended && (
              <motion.div
                key={`last-${k.links.at(-1)?.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[14rem]"
              >
                <CardChip card={k.lastCard} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Dock */}
      <div className="shrink-0 space-y-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
        {ended ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={k.startRun}
              className="rounded-2xl py-4 font-display text-xl tracking-wide text-ink"
              style={{
                background: 'linear-gradient(135deg, #3dffa8, #7dd3fc)',
              }}
            >
              TEKRAR
            </button>
            <button
              type="button"
              onClick={onExit}
              className="rounded-2xl border border-white/15 py-4 text-sm text-fog"
            >
              Ana ekran
            </button>
          </div>
        ) : (
          <>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              disabled={!canSpin || k.phase === 'spinning' || k.phase === 'break'}
              onClick={() => {
                if (k.phase === 'idle') k.startRun()
                k.spin()
              }}
              className="w-full rounded-2xl py-4 disabled:opacity-40"
              style={{
                background:
                  'linear-gradient(135deg, #ffb84d 0%, #3dffa8 55%, #7dd3fc 100%)',
                boxShadow: '0 10px 28px rgba(255,184,77,0.22)',
              }}
            >
              <span className="font-display text-3xl tracking-wider text-ink">
                {k.links.length === 0 ? 'İLK SPİN' : 'DEVAM'}
              </span>
              <span className="mt-0.5 block text-xs font-medium text-ink/70">
                Yeni halka ekle · risk artar
              </span>
            </motion.button>
            <button
              type="button"
              disabled={!canLock}
              onClick={k.lock}
              className="w-full rounded-2xl border border-signal/40 bg-signal/15 py-3.5 font-display text-xl tracking-wide text-signal disabled:opacity-35"
            >
              KİLİTLE {k.links.length > 0 ? k.fmtMult(k.multiplier) : ''}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
