import "./CameraPanel.css";

import type { CameraPanelProps } from "./CameraPanel.types";

export default function CameraPanel({
    isLive,
    fps,
    children,
}: CameraPanelProps) {
    return (
        <section className="camera-panel">

            <header className="camera-panel__header">

                <span className="camera-panel__live">
                    {isLive ? "● LIVE" : "OFFLINE"}
                </span>

                <span className="camera-panel__fps">
                    {fps} FPS
                </span>

            </header>

            <div className="camera-panel__preview">

                {children}

            </div>

            <footer className="camera-panel__footer">

                <h3>
                    Eye Tracking Active
                </h3>

                <p>
                    Keep looking at your selection
                </p>

            </footer>

        </section>
    );
}