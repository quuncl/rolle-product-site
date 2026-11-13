import test from 'node:test';
import assert from 'node:assert/strict';
import { printFrameAt, contactState, PRINT_TIMING } from '../assets/roller-print-motion.js';

const params = {start:-2.03, end:2.03, surface:1.098, radius:.208, width:4.8};

test('pressing finishes before the wheel starts travelling, and lifting follows the complete print', () => {
  assert.deepEqual(printFrameAt(0), {progress:0, frontProgress:0, turn:0, lift:.1, phase:'press'});
  const pressed = printFrameAt(PRINT_TIMING.press);
  assert.equal(pressed.progress, 0); assert.equal(pressed.lift, 0);
  const finishing = printFrameAt(PRINT_TIMING.press + PRINT_TIMING.roll);
  assert.equal(finishing.progress, 1); assert.equal(finishing.lift, 0);
  assert.deepEqual(printFrameAt(PRINT_TIMING.total), {progress:1, frontProgress:1, turn:1, lift:.1, phase:'finish'});
});

test('the finished top print stays visible during the lifted transfer and front print', () => {
  const {pass, transfer, press, roll} = PRINT_TIMING;
  assert.deepEqual(printFrameAt(pass + transfer / 2), {
    progress:1, frontProgress:0, turn:.5, lift:.1, phase:'transfer',
  });
  assert.deepEqual(printFrameAt(pass + transfer + press + roll / 2), {
    progress:1, frontProgress:.5, turn:1, lift:0, phase:'front-roll',
  });
});

test('the wheel touches the carton and the ink head shares its world-space contact', () => {
  for (const progress of [0, .25, .5, .99, 1]) {
    const state = contactState(progress, 0, params);
    assert.ok(Math.abs(state.normal - params.radius - params.surface) < 1e-12);
    assert.ok(Math.abs(state.inkHead * params.width - params.width / 2 - state.x) < 1e-12);
    assert.ok(Math.abs(-state.angle * params.radius - (state.x - params.start)) < 1e-12);
  }
});

test('the front pass rolls in the opposite direction and reveals ink right to left', () => {
  const front = {...params, start:params.end, end:params.start, surface:.925};
  const start = contactState(0, 0, front);
  const end = contactState(1, 0, front);
  assert.equal(start.x, front.start);
  assert.equal(end.x, front.end);
  assert.equal(end.normal, front.surface + front.radius);
  assert.ok(end.inkHead < start.inkHead);
  assert.ok(Math.abs(end.angle * front.radius - (front.start - front.end)) < 1e-12);
});

test('one circumference of travel makes exactly one clockwise revolution', () => {
  const progress = 2 * Math.PI * params.radius / (params.end - params.start);
  assert.ok(Math.abs(contactState(progress, 0, params).angle + 2 * Math.PI) < 1e-12);
});
