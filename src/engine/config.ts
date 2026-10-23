// World and tuning constants. All distances are in world units.
export const SEG_LEN = 200;
export const RUMBLE_LEN = 3;
export const ROAD_W = 2000;
export const LANES = 3;
export const FOV = 100;
export const CAM_H = 1000;
export const DRAW_DIST = 300;
export const FOG_DENSITY = 5;
export const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
export const PLAYER_Z = CAM_H * CAM_DEPTH;

export const MAX_SPEED = SEG_LEN * 60; // 12000 units per second
export const ACCEL = MAX_SPEED / 4.5;
export const BRAKE = -MAX_SPEED * 1.1;
export const DECEL = -MAX_SPEED / 5;
export const OFFROAD_DECEL = -MAX_SPEED / 1.8;
export const OFFROAD_LIMIT = MAX_SPEED / 4;
export const CENTRIFUGAL = 0.3;
export const KMH_AT_MAX = 250;

// Half widths in road offset units (road edge = 1).
export const BIKE_HALF = 0.07;
export const CAR_HALF = 0.2;

// Sprite widths in world units.
export const BIKE_WORLD_W = 300;
export const CAR_WORLD_W = 820;

export const RIVAL_COUNT = 6;
export const TRAFFIC_COUNT = 70;
