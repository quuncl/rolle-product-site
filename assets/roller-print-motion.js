const clamp01 = value => Math.min(1, Math.max(0, value));
const smooth = value => value * value * (3 - 2 * value);
const press = 500, roll = 3800, lift = 500, transfer = 1800;
const pass = press + roll + lift;
export const PRINT_TIMING = {press, roll, lift, pass, transfer, total:2 * pass + transfer};
export const PRINT_CLEARANCE = .1;

function printPassAt(elapsed) {
  const progress = smooth(clamp01((elapsed - press) / roll));
  const raising = smooth(clamp01((elapsed - press - roll) / lift));
  return {progress, lift:PRINT_CLEARANCE * (1 - smooth(clamp01(elapsed / press)) + raising)};
}

export function printFrameAt(elapsed) {
  if (elapsed < pass) {
    return {
      ...printPassAt(elapsed),
      frontProgress:0,
      turn:0,
      phase:elapsed < press ? 'press' : elapsed < press + roll ? 'roll' : 'top-lift',
    };
  }
  const frontElapsed = elapsed - pass - transfer;
  if (frontElapsed < 0) {
    return {progress:1, frontProgress:0, turn:clamp01((elapsed - pass) / transfer), lift:PRINT_CLEARANCE, phase:'transfer'};
  }
  const front = printPassAt(frontElapsed);
  return {
    progress:1,
    frontProgress:front.progress,
    turn:1,
    lift:front.lift,
    phase:frontElapsed < press ? 'front-press' : frontElapsed < press + roll ? 'front-roll' : frontElapsed < pass ? 'front-lift' : 'finish',
  };
}

export function contactState(progress, lift, {start, end, surface, radius, width}) {
  const distance = (end - start) * clamp01(progress);
  const x = start + distance;
  return {x, normal:surface + radius + Math.max(0, lift), angle:-distance / radius, inkHead:(x + width / 2) / width};
}
