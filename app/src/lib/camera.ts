import type { CameraControls } from '@react-three/drei'

/** Shared handle on the camera rig so DOM controls (buttons, keyboard) can drive it. */
export const cam = {
  controls: null as CameraControls | null,
  lastInput: performance.now(),
  homeDist: 170,
  touch() {
    this.lastInput = performance.now()
  },
  home() {
    this.controls?.setLookAt(0, this.homeDist * 0.18, this.homeDist, 0, 0, 0, true)
    this.touch()
  },
  zoom(by: number) {
    this.controls?.dolly(by, true)
    this.touch()
  },
  orbit(az: number, pol: number) {
    this.controls?.rotate(az, pol, true)
    this.touch()
  },
}
