import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { fmtX } from '../../game/math'
import type { GameApi } from '../../game/useGame'
import { CRAFTS, SKINS } from '../../game/vehicles'
import { shareResultCard } from '../../utils/shareCard'
import { shareSelfieCard } from '../../utils/selfieCard'
import { sfx } from '../../utils/audio'
import {
  formatPayoutUsdc,
  formatStakeUsdc,
  receiptLine,
  rngSeedFromString,
  shortCommit,
  verifyCommit,
  verifyFairness,
} from '../../game/fairness'
import { formatUsdcDelta, formatUsd } from '../../game/stableEconomy'

interface Props {
  game: GameApi
}

export function ResultScreen({ game }: Props) {
  const result = game.result
  const [shareHint, setShareHint] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const fairVerified = useMemo(() => {
    if (!result?.fairSeed || result.fairCrashFlags == null) return null
    return verifyFairness(
      {
        seed: result.fairSeed,
        commit: result.fairCommit || '',
        rngSeed: rngSeedFromString(result.fairSeed),
        rolls: result.fairRolls ?? result.fairCrashFlags.length,
        crashFlags: result.fairCrashFlags,
      },
      result.craftId,
    )
  }, [result])

  const [commitOk, setCommitOk] = useState<boolean | null>(null)
  useEffect(() => {
    if (!result?.fairSeed || !result.fairCommit) {
      setCommitOk(null)
      return
    }
    let alive = true
    void verifyCommit(result.fairSeed, result.fairCommit).then((ok) => {
      if (alive) setCommitOk(ok)
    })
    return () => {
      alive = false
    }
  }, [result?.fairSeed, result?.fairCommit])

  const fairBadge =
    fairVerified == null
      ? null
      : fairVerified && commitOk !== false
        ? true
        : false

  if (!result) return null

  const won = result.outcome === 'cashed'
  const craft = CRAFTS[result.craftId]
  const skin = SKINS[result.skinId]
  const rare = skin.rarity !== 'common'

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied('kopyalanamadı')
    }
  }

  const share = async () => {
    if (sharing) return
    setSharing(true)
    setShareHint(null)
    void sfx.unlock()
    try {
      const front = document.querySelector<HTMLVideoElement>('video[data-front-video]')
      const mode =
        result.selfieCaptured && front
          ? await shareSelfieCard(result, front, game.profile.displayName)
          : await shareResultCard(result)
      if (mode === 'download') {
        setShareHint('Kart indirildi · metin kopyalandı')
      } else if (mode === 'copied') {
        setShareHint('Metin kopyalandı')
      }
    } catch {
      setShareHint('Paylaşım başarısız')
    } finally {
      setSharing(false)
      window.setTimeout(() => setShareHint(null), 2800)
    }
  }

  const usdcLine =
    result.usdcPayout != null
      ? formatUsdcDelta(result.usdcPayout)
      : result.stakeAsset
        ? formatPayoutUsdc(result)
        : null

  return (
    <div className="relative z-30 flex h-full flex-col items-center justify-end px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="mb-4 w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-panel backdrop-blur-xl"
      >
        <div
          className="px-5 py-6 text-center"
          style={{
            background: won
              ? 'linear-gradient(180deg, rgba(61,255,168,0.18), transparent)'
              : 'linear-gradient(180deg, rgba(255,77,106,0.22), transparent)',
          }}
        >
          <p className="font-display text-sm tracking-[0.3em] text-fog">
            {result.blind
              ? won
                ? 'KÖR İNİŞ'
                : 'KÖR DÜŞÜŞ'
              : result.challenge
                ? won
                  ? 'CHALLENGE İNİŞ'
                  : 'CHALLENGE DÜŞÜŞ'
                : won
                  ? 'GÜVENLİ İNİŞ'
                  : 'SİNYAL KESİLDİ'}
          </p>
          <p className="mt-1 text-sm text-ice">
            {craft.name}
            {rare ? ` · ${skin.name}` : ''}
          </p>
          <p
            className={`mt-2 font-display text-[clamp(3.5rem,16vw,5rem)] leading-none ${
              won ? 'text-signal' : 'text-danger'
            }`}
          >
            {won ? fmtX(result.multiplier) : '0x'}
          </p>

          {usdcLine && (
            <p
              className={`mt-3 font-display text-3xl ${
                won ? 'text-signal' : 'text-danger'
              }`}
            >
              {usdcLine}
            </p>
          )}

          <p className="mt-2 text-sm text-fog">
            Katman {result.layer || 0}
            {result.usdcStake != null
              ? ` · bahis ${formatUsd(result.usdcStake)} USDC`
              : won
                ? ' · kilitlendi'
                : ' · kazanç sıfır'}
          </p>

          {!won && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-5 font-display text-2xl text-amber"
            >
              {fmtX(result.nearMissMultiplier)}&apos;e AZ KALDI!
            </motion.p>
          )}
          {!won && (
            <p className="mt-2 text-sm text-fog">
              Devam etseydin: {fmtX(result.nearMissMultiplier)} kazanacaktın
            </p>
          )}
          {won && result.bombUsed && (
            <p className="mt-2 text-xs text-amber">Sinyal bombası kullanıldı</p>
          )}
          {won && result.skyBonus && result.skyBonus > 0 && (
            <p className="mt-2 text-xs text-ice">
              Gökyüzü bonusu +{Math.round(result.skyBonus * 100)}%
            </p>
          )}
          {result.eyeShieldUsed && (
            <p className="mt-2 text-xs text-signal">Göz kalkanı kurtardı</p>
          )}
          {won && result.smileCashOut && (
            <p className="mt-2 text-xs text-amber">Gülümseme ile indin</p>
          )}
          {won && result.selfieCaptured && (
            <p className="mt-2 text-xs text-ice">Selfie Pilot ✓</p>
          )}
          {won && !result.selfieCaptured && (
            <p className="mt-2 text-xs text-fog">
              Ön kamerada yüzünü 2 sn tut — selfie rozeti
            </p>
          )}
          {result.duelId && (
            <p className="mt-2 text-xs text-signal">
              Düello {result.duelId}
              {game.duelVerdictText ? ` · ${game.duelVerdictText}` : ''}
            </p>
          )}
          {result.chatBlind && (
            <p className="mt-2 text-xs text-ice">Chat kör uçuş</p>
          )}
          {result.boostTable && (
            <p className="mt-2 text-xs text-amber">
              Boost masa{won ? ' · +0.50 USDC cashback' : ''}
            </p>
          )}
          {result.starsStake != null && result.starsStake > 0 && (
            <p className="mt-2 text-xs text-amber">-{result.starsStake} Stars</p>
          )}
          {(result.windCatches ?? 0) > 0 && (
            <p className="mt-2 text-xs text-ice">
              Rüzgar {result.windCatches}× yakalandı
            </p>
          )}
          {result.weekly && (
            <p className="mt-2 text-xs text-signal">Haftalık lig uçuşu</p>
          )}
          {game.retentionHint && (
            <p className="mt-2 text-xs text-signal">{game.retentionHint}</p>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3 text-left">
          <p className="text-[10px] uppercase tracking-wider text-fog">
            USDC makbuz
          </p>
          <p className="mt-1 text-sm text-white">{receiptLine(result)}</p>
          {result.stakeAsset && (
            <p className="mt-0.5 text-xs text-fog">
              Stake {formatStakeUsdc(result.stakeAmount, result.stakeAsset)}
              {result.ledgerId ? ` · ${result.ledgerId.slice(0, 12)}…` : ''}
            </p>
          )}

          {result.fairCommit && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-fog">
                  Provably fair
                </p>
                {fairBadge != null && (
                  <span
                    className={`text-[10px] font-semibold ${
                      fairBadge ? 'text-signal' : 'text-danger'
                    }`}
                  >
                    {fairBadge ? 'DOĞRULANDI' : 'UYUŞMAZ'}
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-[11px] text-ice">
                commit {shortCommit(result.fairCommit)}
              </p>
              {result.fairSeed && (
                <p className="mt-0.5 truncate font-mono text-[10px] text-fog">
                  seed {result.fairSeed}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copy('commit', result.fairCommit || '')}
                  className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-fog"
                >
                  Commit kopyala
                </button>
                {result.fairSeed && (
                  <button
                    type="button"
                    onClick={() => void copy('seed', result.fairSeed || '')}
                    className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-fog"
                  >
                    Seed kopyala
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => game.setScreen('wallet')}
                  className="rounded-lg border border-signal/30 px-2 py-1 text-[11px] text-signal"
                >
                  Ledger’a git
                </button>
              </div>
              {copied && (
                <p className="mt-1 text-[10px] text-signal">Kopyalandı: {copied}</p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={share}
            disabled={sharing}
            className="rounded-xl border border-white/15 bg-white/5 py-3.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {sharing ? 'Hazırlanıyor…' : 'Paylaş'}
          </button>
          <button
            type="button"
            onClick={() => void game.shareStory()}
            className="rounded-xl border border-ice/30 bg-ice/10 py-3.5 text-sm font-medium text-ice"
          >
            Story
          </button>
          <button
            type="button"
            onClick={() => {
              void game.startFlight()
            }}
            className="col-span-2 rounded-xl py-3.5 text-sm font-semibold text-ink"
            style={{
              background: 'linear-gradient(135deg, #3dffa8, #7dd3fc)',
            }}
          >
            Tekrar uç
          </button>
        </div>
        {shareHint && (
          <p className="px-4 pb-3 text-center text-xs text-fog">{shareHint}</p>
        )}
      </motion.div>

      <button
        type="button"
        onClick={game.goHome}
        className="mb-2 text-sm text-fog underline-offset-4 hover:underline"
      >
        Ana ekrana dön
      </button>
    </div>
  )
}
