import "./CameraPanel.css";

import type { CameraPanelProps } from "./CameraPanel.types";

export default function CameraPanel({
    children,
}: CameraPanelProps) {
    return (
        <section className="camera-panel">
            {children}
        </section>
    );
}
