import { useEffect, useRef } from 'react';

const ROWS: Array<[string, string, string, string]> = [
  ['Steer', '← → or A D', 'Hold the left pad. Slide further to turn harder', 'Left stick or d-pad'],
  ['Throttle', '↑ or W', 'Automatic', 'Right trigger'],
  ['Brake', '↓ or S', 'BRAKE', 'Left trigger'],
  ['Punch', 'J or Z', 'PUNCH', 'X'],
  ['Kick', 'K or X', 'KICK', 'A or B'],
  ['Swing weapon', 'L or C', 'Weapon button, shown when you hold one', 'Y'],
  ['Pause', 'P or Esc', 'Pause button, top center', 'Start'],
  ['Sound', 'M', 'Speaker button', ''],
];

export function Help({ onBack }: { onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo(0, 0);
  }, []);
  return (
    <div className="screen panel solid" role="dialog" aria-labelledby="helpTitle" ref={ref}>
      <div className="card wide">
        <h2 id="helpTitle" className="h-small">
          How to play
        </h2>
        <p className="lead">Finish in the top 3 on every track to move up a level. Knock riders off their bikes on the way for cash, and spend it in the garage.</p>
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
              {ROWS.map(([a, k, t, g]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td>
                    {k.split(' or ').map((part, i) => (
                      <span key={part}>
                        {i > 0 && ' or '}
                        {part.split(' ').map((key) => (
                          <kbd key={key}>{key}</kbd>
                        ))}
                      </span>
                    ))}
                  </td>
                  <td>{t}</td>
                  <td>{g}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tips">
          <div>
            <b>Fighting</b> Ride next to a rider, within half a lane, then punch or kick. Kicks hit harder, reach further and push riders toward traffic.
          </div>
          <div>
            <b>Weapons</b> Some riders carry a club or a chain. Knock one out to take it. A kick can also knock it loose. A club has 6 swings, a chain has 8 and reaches further.
          </div>
          <div>
            <b>Police</b> From level 2 the police chase you. If they catch you crashed or crawling, you are busted: the race ends and you pay a fine. Stay fast, or knock them off.
          </div>
          <div>
            <b>Garage</b> Spend race cash on new bikes and upgrades. Engine adds speed, tyres add grip, armour adds health.
          </div>
          <div>
            <b>Map and health</b> Map top right: white dot is you, colored dots are rivals, flashing dot is the police. Health bar top left refills after 3 seconds clear of hits.
          </div>
          <div>
            <b>Bonus</b> Pass cars closely at speed for a near miss. Chain hits and near misses for a combo up to x10.
          </div>
        </div>
        <button type="button" className="cta" data-primary onClick={onBack}>
          Got it
        </button>
      </div>
    </div>
  );
}
