// Turns content plus the player's save into the RaceSetup the engine runs.

import { bikeById, bikeStats } from '../content/bikes';
import { levelDef } from '../content/career';
import { trackById } from '../content/tracks';
import type { RaceSetup } from '../engine/game';
import type { SaveData } from '../save/save';

export function raceSetup(save: SaveData, level: number, trackId: string): RaceSetup {
  const bike = bikeById(save.selectedBike);
  const owned = save.bikes[bike.id];
  return {
    track: trackById(trackId),
    bike: bikeStats(bike, owned.upgrades),
    level: levelDef(level),
    tutorial: save.settings.hints && save.stats.races < 3,
    reduceMotion: save.settings.reduceMotion,
    vibration: save.settings.vibration,
  };
}
