# Frontend Documentation

The frontend is a React Native application that also builds for the browser with Vite. The same product provides a communication board for patients and a notification-oriented workflow for nurses.

## Responsibilities

- Render the communication board and accessible controls.
- Acquire camera input and expose tracking state to the UI.
- Estimate gaze targets and support dwell-based selection.
- Run calibration and smoothing before gaze results reach interaction logic.
- Display and create patient and nurse notifications through backend services.
- Provide browser, Android, and iOS entry points where platform capabilities allow.

## Structure

| Directory | Purpose |
| --- | --- |
| `src/browser` | Browser entry point, camera lifecycle, tracking app, and responsive web layouts |
| `src/components` | Reusable camera, communication, layout, tracking, accessibility, and settings components |
| `src/vision` | MediaPipe adapters, landmark mapping, gaze estimation, calibration, and temporal filtering |
| `src/interaction` | Dwell selection and interaction state |
| `src/services` | HTTP, WebSocket, patient, notification, and live-monitoring clients |
| `src/screens` | Screen-level views such as the nurse notifications page |
| `src/modelTesting` | Calibration diagnostics, session data, and export helpers |
| `src/theme` | Shared colors, typography, spacing, radius, shadows, and animations |
| `__tests__` | Browser, calibration, gaze, interaction, MediaPipe, pose, tracking, and model tests |

`App.tsx` provides the React Native root and mounts `BrowserTrackingApp`. Native Android and iOS projects live in `android/` and `ios/`; browser assets and MediaPipe files live in `public/`.

## Interaction pipeline

1. The camera produces frames in the platform-specific camera layer.
2. MediaPipe Face Landmarker extracts face landmarks and blendshape information.
3. Landmark adapters and gaze estimators calculate a candidate gaze position.
4. Calibration maps gaze observations to screen coordinates.
5. Head movement compensation and temporal filters reduce jitter.
6. The dwell controller turns a stable gaze target into a selection.
7. The communication board updates the selected action and may send a notification.

The web implementation can also use WebGazer. Tracking is intentionally kept behind adapters so browser and native camera implementations can evolve independently.

## Development

```powershell
cd app/frontend
npm install
npm run start:web
```

Useful commands:

```powershell
npm run build:web
npm run typecheck
npm run lint
npm test
npm test -- --runInBand
```

For Android, run Metro with `npm start`, then use `npm run android` from another terminal. iOS requires macOS, Xcode, and CocoaPods; see [Android development setup](../android-development-setup.md) for the Android prerequisites.

## Backend integration

The API base URL and route constants are defined in `src/constants/api.ts`. The frontend uses REST for patient and notification operations and WebSocket connections for live notification updates. During local web development, the expected backend is `http://localhost:8000` and the Vite app is usually served from `http://localhost:5173`.

Camera access requires browser or device permission. Browser builds also need the model and WASM assets in `public/models/` and `public/wasm/`.

## Testing notes

Tests are organized around behavior rather than implementation details. Calibration and gaze tests cover numerical transformations and target selection; tracking and MediaPipe tests cover adapters and state transitions; interaction tests cover dwell behavior. Run the focused test file while iterating, then run the complete Jest suite before a release build.