# WebGazer experiment

The browser app uses WebGazer by default on this branch. Add `?gazeProvider=l2cs` to the URL to run the existing L2CS path.

WebGazer shares the app's camera stream and existing nine-dot calibration UI. Accepted training samples are recorded in WebGazer; a separate reversed-order pass is held out and scored without adding its labels to the model. Gaze selection remains unavailable until all targets have enough samples and held-out RMS error passes the existing calibration limit. Starting a calibration clears WebGazer's learned data.

RidgeReg retains only 50 click samples, so training records at most five spaced samples per target (45 total). The debug gaze marker uses the screen coordinates directly; the camera preview alone is mirrored.

The MediaPipe Face Mesh assets used by WebGazer are copied from its package into `public/webgazer/face_mesh` by Vite. The generated public copy is ignored by Git.

This is an experiment, not a validated replacement. Compare held-out accuracy and selection latency against L2CS on the same camera before adopting it for assistive use. WebGazer is GPL-3.0-or-later, so confirm the project's distribution/licensing requirements before release.
