# Model testing

This folder contains optional calibration experiments and JSON exports. Production tracking does not create a `ModelTestingSession`, so it does not collect diagnostic samples or download files.

To enable the diagnostics for a browser demo, pass the opt-in prop at the browser app boundary:

```tsx
<BrowserTrackingApp modelTesting />
```

The session downloads these files when calibration completes:

- `gaze-calibration-fit-comparison-*.json`
- `gaze-eye-diagnostics-*.json`

The comparison export includes ordinary, raw, compensated, pose-conditioned, and leave-one-target-out results. The runtime mapper remains in `src/vision/gazeCalibration.ts` and has no JSON download side effects.
