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

        <div className="camera-panel__live">

            <span className="camera-panel__live-dot" />

            LIVE

        </div>

        <div className="camera-panel__fps">

            60 FPS

        </div>

    </header>

    <div className="camera-panel__content">

        {children}

    </div>

    <footer className="camera-panel__footer">

        <div>

            <h3>Eye Tracking Active</h3>

            <p>
                Look at an option to communicate.
            </p>

        </div>

        <button className="camera-panel__fullscreen">

            ⛶

        </button>

    </footer>

        </section>
    );
}