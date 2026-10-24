import { useCallback, useEffect, useRef, useState } from 'react';
import { track as logPlay } from '../app/analytics';
import type { GameHost } from '../app/host';
import { raceSetup } from '../app/setup';
import { TRACKS } from '../content/tracks';
import type { Results } from '../engine/game';
import { loadSave, recordRace, unlockedLevel, writeSave, type SaveData } from '../save/save';
import { Career } from './screens/Career';
import { Garage } from './screens/Garage';
import { Help } from './screens/Help';
import { Pause } from './screens/Pause';
import { ResultsScreen } from './screens/Results';
import { Settings } from './screens/Settings';
import { Title } from './screens/Title';

export type Screen = 'title' | 'career' | 'garage' | 'help' | 'settings' | 'race' | 'results';

export interface LastRace {
  results: Results;
  earnings: number;
  unlocked: number | null;
  cashAfter: number;
  newBest: boolean;
}

export function App({ host }: { host: GameHost }) {
  const [save, setSaveState] = useState<SaveData>(loadSave);
  const [screen, setScreen] = useState<Screen>('title');
  const [back, setBack] = useState<Screen>('title');
  const [paused, setPaused] = useState(false);
  const [level, setLevel] = useState(() => unlockedLevel(loadSave()));
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [last, setLast] = useState<LastRace | null>(null);
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
    (lvl: number, track: string) => {
      setLevel(lvl);
      setTrackId(track);
      setPaused(false);
      setScreen('race');
      host.startRace(raceSetup(saveRef.current, lvl, track));
      logPlay('race_start', { track, level: lvl, bike: saveRef.current.selectedBike });
    },
    [host],
  );

  // Wire host callbacks once.
  useEffect(() => {
    host.setMuted(saveRef.current.settings.muted);
    host.setMusicVolume(saveRef.current.settings.music);
    host.applyComfort(saveRef.current.settings);
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
      const { save: next, unlocked } = recordRace(s, {
        level: r.level,
        trackId: r.trackId,
        place: r.place,
        earnings: r.score,
        kos: r.kos + r.copKos,
        busted: r.busted,
        fine: r.fine,
        score: r.score,
      });
      setSave(next);
      setLast({ results: r, earnings: r.score, unlocked, cashAfter: next.cash, newBest: r.score > prevBest });
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
    host.applyComfort(save.settings);
  }, [host, save.settings]);

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
      {screen === 'title' && <Title save={save} go={go} />}
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
          onRestart={() => race(level, trackId)}
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
          onAgain={() => race(level, trackId)}
          onNext={nextTrack}
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
