import { useCallback, useEffect, useRef, useState } from 'react';
import { track as logPlay } from '../app/analytics';
import type { GameHost } from '../app/host';
import { raceSetup } from '../app/setup';
import { enterGameMode, installCardDue, isImmersive, iosBrowser, isTouchDevice, markInstallCard, turnTipDue } from '../app/gameMode';
import { InstallCard } from './InstallCard';
import { ChallengeScreen } from './screens/Challenge';
import { challengeFromUrl, clearChallengeUrl } from '../app/challenge';
import type { Ghost } from '../engine/ghost';
import { dailyFor, dayBefore, type DailyRace } from '../content/daily';
import { TRACKS } from '../content/tracks';
import type { Results } from '../engine/game';
import { cleanName, loadSave, recordDaily, recordRace, unlockedLevel, writeSave, type SaveData } from '../save/save';
import { Career } from './screens/Career';
import { Garage } from './screens/Garage';
import { Help } from './screens/Help';
import { Pause } from './screens/Pause';
import { ResultsScreen } from './screens/Results';
import { Settings } from './screens/Settings';
import { Title } from './screens/Title';

export type Screen = 'title' | 'career' | 'garage' | 'help' | 'settings' | 'race' | 'results' | 'challenge';

export interface LastRace {
  results: Results;
  earnings: number;
  unlocked: number | null;
  cashAfter: number;
  newBest: boolean;
  /** This race as a ghost, ready to send as a challenge. Missing when busted. */
  myGhost?: Ghost;
  /** The ghost this race was against, if it was a challenge. */
  challenge?: Ghost;
  /** Set when this was the daily race. */
  daily?: { race: DailyRace; best: number | null; paid: number; newBest: boolean; streak: number };
}

export function App({ host }: { host: GameHost }) {
  const [save, setSaveState] = useState<SaveData>(loadSave);
  // A "Beat my time" link opens on the challenge card.
  const [incoming, setIncoming] = useState<Ghost | null>(challengeFromUrl);
  const [screen, setScreen] = useState<Screen>(() => (incoming ? 'challenge' : 'title'));
  /** The ghost for the race running now, if it is a challenge. */
  const raceGhost = useRef<Ghost | null>(null);
  /** The daily race running now, if any. */
  const raceDaily = useRef<DailyRace | null>(null);
  const [back, setBack] = useState<Screen>('title');
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(() => unlockedLevel(loadSave()));
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [last, setLast] = useState<LastRace | null>(null);
  // iPhone: the Add to Home Screen card, and the turn-sideways tip in a race.
  const [installCard, setInstallCard] = useState<'first' | 'third' | null>(null);
  const [turnTip, setTurnTip] = useState(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  const setSave = useCallback((s: SaveData) => {
    setSaveState(s);
    writeSave(s);
  }, []);

  const go = useCallback(
    (to: Screen) => {
      if (to === 'help' || to === 'settings') setBack(screen === 'help' || screen === 'settings' ? back : screen);
      setScreen(to);
    },
    [screen, back],
  );

  const race = useCallback(
    (lvl: number, track: string, ghost: Ghost | null = null, daily: DailyRace | null = null) => {
      raceGhost.current = ghost;
      raceDaily.current = daily;
      // Challenges and the daily run at their own level; the career stays where it was.
      if (!ghost && !daily) {
        setLevel(lvl);
        setTrackId(track);
      }
      setPaused(false);
      setScreen('race');
      // Game mode: full screen on phones. This runs inside the tap that starts the race.
      if (saveRef.current.settings.gameMode && isTouchDevice()) enterGameMode();
      // iPhone browser tab: a sideways phone hides most of the browser bars.
      setTurnTip(turnTipDue());
      host.startRace({ ...raceSetup(saveRef.current, lvl, track), ghost, noFine: !!ghost || !!daily });
      logPlay('race_start', { track, level: lvl, bike: saveRef.current.selectedBike, mode: daily ? 'daily' : ghost ? 'challenge' : 'career' });
    },
    [host],
  );

  // Wire host callbacks once.
  useEffect(() => {
    host.setMuted(saveRef.current.settings.muted);
    host.setMusicVolume(saveRef.current.settings.music);
    host.applyComfort(saveRef.current.settings);
    host.applyQuality(saveRef.current.settings.quality, saveRef.current.settings.lowDetected);
    host.onQualityDrop = () => {
      const s = saveRef.current;
      setSave({ ...s, settings: { ...s.settings, lowDetected: true } });
    };
    host.attract(raceSetup(saveRef.current, 1, TRACKS[0].id));
    host.onPauseChange = setPaused;
    host.onMuteToggle = () => {
      const s = saveRef.current;
      const next = { ...s, settings: { ...s.settings, muted: !s.settings.muted } };
      host.setMuted(next.settings.muted);
      setSave(next);
    };
    host.onFinish = (r) => {
      const s = saveRef.current;
      const prevBest = s.bestScore[r.trackId] ?? 0;
      const vs = raceGhost.current;
      const daily = raceDaily.current;
      const { save: afterRace, unlocked } = recordRace(s, {
        challenge: !!vs || !!daily,
        level: r.level,
        trackId: r.trackId,
        place: r.place,
        earnings: r.score,
        kos: r.kos + r.copKos,
        busted: r.busted,
        fine: r.fine,
        score: r.score,
      });
      // The daily: best time, first-finish bonus and the day streak.
      let next = afterRace;
      let dailyInfo: LastRace['daily'];
      if (daily) {
        const d = recordDaily(afterRace, daily.key, dayBefore(daily.key), r.busted ? null : r.time, daily.bonus);
        next = d.save;
        dailyInfo = { race: daily, best: next.daily.best, paid: d.paid, newBest: d.newBest, streak: next.streak.days };
        logPlay('daily_end', { key: daily.key, track: daily.trackId, finished: r.busted ? 0 : 1, best: d.newBest ? 1 : 0, streak: next.streak.days });
      }
      setSave(next);
      // This race as a ghost, so the player can dare a friend to beat it.
      const rec = host.game.recorder;
      const myGhost: Ghost | undefined = r.busted
        ? undefined
        : { trackId: r.trackId, level: r.level, bikeId: s.selectedBike, time: r.time, place: r.place, name: s.settings.name, d: [...rec.d], x: [...rec.x] };
      setLast({ results: r, earnings: r.score, unlocked, cashAfter: next.cash, newBest: r.score > prevBest, myGhost, challenge: vs ?? undefined, daily: dailyInfo });
      if (vs) logPlay('challenge_result', { won: !r.busted && r.time < vs.time ? 1 : 0, track: r.trackId });
      logPlay('race_end', { place: r.place, time: Math.round(r.time * 10) / 10, busted: r.busted ? 1 : 0, kos: r.kos + r.copKos });
      if (unlocked) {
        setLevel(unlocked);
        logPlay('level_unlock', { level: unlocked });
      }
      setScreen('results');
    };
  }, [host, setSave]);

  useEffect(() => {
    host.setMusicVolume(save.settings.music);
  }, [host, save.settings.music]);

  useEffect(() => {
    host.applyQuality(save.settings.quality, save.settings.lowDetected);
  }, [host, save.settings.quality, save.settings.lowDetected]);

  useEffect(() => {
    host.applyComfort(save.settings);
  }, [host, save.settings]);

  // Once per load: count Home Screen launches, so we can see if the install card works.
  useEffect(() => {
    logPlay('app_open', { display: isImmersive() ? 'home_screen' : 'browser', ios: iosBrowser() ?? 'no' });
    const g = challengeFromUrl();
    if (g) logPlay('challenge_open', { track: g.trackId, level: g.level });
    // A challenge link opened while the game is already open in this tab.
    const onHash = () => {
      const next = challengeFromUrl();
      if (!next || host.racing) return;
      logPlay('challenge_open', { track: next.trackId, level: next.level });
      setIncoming(next);
      setScreen('challenge');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [host]);

  // The install card shows on the title or career screen: before the first race, and after the third.
  useEffect(() => {
    if (screen !== 'title' && screen !== 'career') return;
    const due = installCardDue(save.stats.races);
    if (!due) return;
    markInstallCard(due);
    setInstallCard(due);
    logPlay('install_card', { action: 'shown', when: due, browser: iosBrowser() ?? 'other' });
  }, [screen, save.stats.races]);

  useEffect(() => {
    if (!turnTip) return;
    const t = setTimeout(() => setTurnTip(false), 4500);
    const off = () => setTurnTip(false);
    window.addEventListener('orientationchange', off);
    return () => {
      clearTimeout(t);
      window.removeEventListener('orientationchange', off);
    };
  }, [turnTip]);

  // Enter, Space or the gamepad A button act on the main button of each screen.
  useEffect(() => {
    host.onConfirm = () => {
      if (host.isPaused) host.setPaused(false);
      else document.querySelector<HTMLButtonElement>('[data-primary]')?.click();
    };
  }, [host]);

  // Show the chosen track behind the career map.
  useEffect(() => {
    if (screen === 'career') host.attract(raceSetup(saveRef.current, level, trackId));
  }, [screen, level, trackId, host]);

  const nextTrack = () => {
    const i = TRACKS.findIndex((t) => t.id === trackId);
    race(level, TRACKS[(i + 1) % TRACKS.length].id);
  };

  return (
    <>
      {screen === 'title' && <Title save={save} go={go} onDaily={(d) => race(d.level, d.trackId, null, d)} />}
      {screen === 'challenge' && incoming && (
        <ChallengeScreen
          ghost={incoming}
          onRace={() => {
            clearChallengeUrl();
            race(incoming.level, incoming.trackId, incoming);
          }}
          onSkip={() => {
            clearChallengeUrl();
            setIncoming(null);
            setScreen('title');
          }}
        />
      )}
      {installCard && (
        <InstallCard
          onClose={() => {
            logPlay('install_card', { action: 'closed', when: installCard, browser: iosBrowser() ?? 'other' });
            setInstallCard(null);
          }}
        />
      )}
      {screen === 'race' && turnTip && (
        <div className="turn-tip" role="status">
          <span className="phone" aria-hidden="true" />
          Turn your phone sideways for a bigger view
        </div>
      )}
      {screen === 'career' && (
        <Career
          save={save}
          level={level}
          setLevel={setLevel}
          trackId={trackId}
          setTrackId={setTrackId}
          race={race}
          go={go}
        />
      )}
      {screen === 'garage' && <Garage save={save} setSave={setSave} go={go} back={() => setScreen(back === 'garage' ? 'career' : 'career')} />}
      {screen === 'help' && <Help keys={save.settings.keys} onBack={() => setScreen(back)} />}
      {screen === 'settings' && <Settings save={save} setSave={setSave} host={host} onBack={() => setScreen(back)} />}
      {screen === 'race' && paused && (
        <Pause
          onResume={() => host.setPaused(false)}
          onRestart={() => {
            const g = raceGhost.current;
            const d = raceDaily.current;
            if (d) race(d.level, d.trackId, null, d);
            else if (g) race(g.level, g.trackId, g);
            else race(level, trackId);
          }}
          onHelp={() => {
            setBack('race');
            setScreen('help');
          }}
          onQuit={() => {
            host.attract(raceSetup(save, level, trackId));
            setPaused(false);
            setScreen('career');
          }}
        />
      )}
      {screen === 'results' && last && (
        <ResultsScreen
          last={last}
          save={save}
          onAgain={() => {
            if (last.daily) {
              // A new UTC day may have started since; race whatever is today's.
              const d = dailyFor();
              race(d.level, d.trackId, null, d);
            } else if (last.challenge) race(last.challenge.level, last.challenge.trackId, last.challenge);
            else race(level, trackId);
          }}
          onNext={nextTrack}
          setName={(name) => setSave({ ...saveRef.current, settings: { ...saveRef.current.settings, name: cleanName(name) } })}
          onCareer={() => setScreen('career')}
          onGarage={() => {
            setBack('career');
            setScreen('garage');
          }}
        />
      )}
    </>
  );
}
