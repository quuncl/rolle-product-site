import test from 'node:test';
import assert from 'node:assert/strict';
import { advancePose, takePoseControl, cameraFrame, fixedCameraFrame } from '../assets/roller-motion.js';

const pose = () => ({yaw:0, pitch:0, displayedYaw:0, displayedPitch:0, phase:0, interacted:false});

test('taking control preserves the currently displayed automatic/scroll pose', () => {
  const state = {...pose(), displayedYaw:.47, displayedPitch:.19, phase:1.5};
  takePoseControl(state);
  advancePose(state, .016, {scrollProgress:.8});
  assert.equal(state.displayedYaw, .47);
  assert.equal(state.displayedPitch, .19);
  assert.equal(state.yaw, .47);
});

test('the first frame after returning to visibility does not jump to a new phase', () => {
  const state = {...pose(), phase:1.5, displayedYaw:.17};
  advancePose(state, 0, {scrollProgress:1});
  assert.equal(state.phase, 1.5);
  assert.equal(state.displayedYaw, .17);
});

test('a large scroll change approaches the target instead of snapping', () => {
  const state = pose();
  advancePose(state, .016, {scrollProgress:1});
  assert.ok(state.displayedYaw > 0 && state.displayedYaw < .2);
});

test('reduced motion applies manual pose without starting automatic animation', () => {
  const state = {...pose(), yaw:.4, pitch:.3, interacted:true};
  assert.equal(advancePose(state, .016, {reducedMotion:true}), false);
  assert.equal(state.displayedYaw, .4);
  assert.equal(state.displayedPitch, .3);
  assert.equal(state.phase, 0);
});

test('the fixed camera envelope encloses the rotating assembly on narrow and wide screens', () => {
  for (const aspect of [.4, 1, 3]) {
    const frame = cameraFrame(1.25, aspect);
    assert.ok(frame.right >= 1.25 && frame.top >= 1.25);
    assert.equal(frame.left, -frame.right);
    assert.equal(frame.bottom, -frame.top);
  }
});

test('the frontal print camera fits the full vertical tool without wasting the narrow canvas', () => {
  for (const aspect of [.25, .5628, 1]) {
    const frame = fixedCameraFrame(.42, 2.15, aspect);
    assert.ok(frame.right >= .42 / 2 && frame.top >= 2.15 / 2);
    assert.ok(2.15 / (frame.top - frame.bottom) > .9);
  }
});
