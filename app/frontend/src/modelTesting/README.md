# Model testing

This folder contains calibration experiments and JSON exports. The browser demo creates a `ModelTestingSession` for its calibration diagnostics.

For a diagnostics-only build, render `BrowserTrackingApp` with `enableDiagnostics` set to `true`. After a calibration pass finishes, the session automatically downloads the diagnostics JSON; a second validation pass adds the comparison data. Set the argument to `false` in production. The session downloads this file:

- `gaze-calibration-diagnostics-*.json`

The downloaded JSON contains calibration comparison data and eye diagnostics. The comparison data includes ordinary, raw, compensated, pose-conditioned, and leave-one-target-out results. Validation captures also include min/max/range/mean summaries for yaw, pitch, eye scale, and inter-eye distance. Pose fitting uses median gaze and pose values per target to reduce the effect of bad frames. The runtime mapper remains in `src/vision/gazeCalibration.ts` and has no JSON download side effects.
