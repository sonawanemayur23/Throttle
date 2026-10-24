import { useEffect, useRef } from 'react';
import { RACE_ACTIONS, actionLabel, keyLabel, type RaceAction } from '../../save/save';
import { TopNav } from '../parts';

const TOUCH: Record<RaceAction, string> = {
  left: 'Hold the left pad. Slide further to turn harder',
  right: 'Hold the left pad. Slide further to turn harder',
  up: 'Automatic',
  down: 'BRAKE',
  punch: 'PUNCH',
  kick: 'KICK',
  weapon: 'Weapon button, shown when you hold one',
};

const PAD: Record<RaceAction, string> = {
  left: 'Left stick or d-pad',
  right: 'Left stick or d-pad',
  up: 'Right trigger',
  down: 'Left trigger',
  punch: 'X',
  kick: 'A or B',
  weapon: 'Y',
};

const TIPS: Array<[string, string]> = [
  ['Fighting', 'Ride next to a rider, within half a lane, then punch or kick. Kicks hit harder, reach further and push riders toward traffic.'],
  ['Weapons', 'Some riders carry a club or a chain. Knock one out to take it. A kick can also knock it loose. A club has 6 swings, a chain has 8 and reaches further.'],
  ['Police', 'From level 2 the police chase you. If they catch you crashed or crawling, you are busted: the race ends and you pay a fine. Stay fast, or knock them off.'],
  ['Garage', 'Spend race cash on new bikes and upgrades. Engine adds speed, tyres add grip, armour adds health.'],
  ['Map and health', 'Map top right: white dot is you, colored dots are rivals, flashing dot is the police. Health refills after 3 seconds clear of hits.'],
  ['Bonus', 'Pass cars closely at speed for a near miss. Chain hits and near misses for a combo up to x10.'],
];

export function Help({ onBack, keys }: { onBack: () => void; keys: Record<RaceAction, string[]> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo(0, 0);
  }, []);
  return (
    <div className="scr solid" role="dialog" aria-labelledby="helpTitle" ref={ref}>
      <div className="wrap">
        <TopNav title="How to play" onBack={onBack} />
        <p className="muted" style={{ margin: 0, maxWidth: '60ch' }} id="helpTitle">
          Finish in the top 3 on every track to move up a level. Knock riders off their bikes on the way for cash, and spend it in the garage.
        </p>
        <div className="tablewrap">
          <table className="controls">
            <thead>
              <tr>
                <th>Action</th>
                <th>Keyboard</th>
                <th>Phone</th>
                <th>Gamepad</th>
              </tr>
            </thead>
            <tbody>
              {RACE_ACTIONS.map((action) => (
                <tr key={action}>
                  <td>{actionLabel(action)}</td>
                  <td>
                    {keys[action].map((code, i) => (
                      <span key={code}>
                        {i > 0 && ' or '}
                        <kbd>{keyLabel(code)}</kbd>
                      </span>
                    ))}
                  </td>
                  <td>{TOUCH[action]}</td>
                  <td>{PAD[action]}</td>
                </tr>
              ))}
              <tr>
                <td>Pause</td>
                <td>
                  <kbd>P</kbd> or <kbd>Esc</kbd>
                </td>
                <td>Pause button, top center</td>
                <td>Start</td>
              </tr>
              <tr>
                <td>Sound</td>
                <td>
                  <kbd>M</kbd>
                </td>
                <td>Sound and music in Settings</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="tips">
          {TIPS.map(([h, t]) => (
            <div className="panel" key={h}>
              <b>{h}</b>
              {t}
            </div>
          ))}
        </div>
        <button type="button" className="btn wide" data-primary onClick={onBack}>
          Got it
        </button>
      </div>
    </div>
  );
}
