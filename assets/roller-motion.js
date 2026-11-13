// Pose offsets relative to the original view. Keep animation time local to visibility.
export function advancePose(state, elapsed, {reducedMotion = false, scrollProgress = 0} = {}) {
  const auto = !reducedMotion && !state.interacted;
  if (auto) state.phase += elapsed * .25;
  const targetYaw = state.yaw + (auto ? Math.sin(state.phase) * .2 + scrollProgress * .65 : 0);
  const blend = reducedMotion ? 1 : 1 - Math.exp(-10 * elapsed);
  state.displayedYaw += (targetYaw - state.displayedYaw) * blend;
  state.displayedPitch += (state.pitch - state.displayedPitch) * blend;
  return auto;
}

export function takePoseControl(state) {
  if (state.interacted) return;
  // Continue from the exact displayed pose, including automatic/scroll offsets.
  state.yaw = state.displayedYaw;
  state.pitch = state.displayedPitch;
  state.interacted = true;
}

export function cameraFrame(radius, aspect) {
  // One fixed envelope for every wheel/body rotation; only viewport changes reframe it.
  const half = radius * 1.1 * Math.max(1, 1 / aspect);
  return {left:-half * aspect, right:half * aspect, top:half, bottom:-half};
}

export function fixedCameraFrame(width, height, aspect) {
  // The printing view has one fixed orientation, so fit its actual silhouette.
  const half = Math.max(height, width / aspect) * .53;
  return {left:-half * aspect, right:half * aspect, top:half, bottom:-half};
}
