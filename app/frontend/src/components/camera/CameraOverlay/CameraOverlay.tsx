import "./CameraOverlay.css";

import {
    Radio,
} from "lucide-react";

import type { CameraOverlayProps } from "./CameraOverlay.types";

export default function CameraOverlay({
    isLive,
    fps: _fps,
}: CameraOverlayProps) {
    return (
        <>
            <div className="camera-overlay__header">
                <div
                    className={`camera-overlay__live ${
                        isLive
                            ? "camera-overlay__live--active"
                            : ""
                    }`}
                >
                    <Radio size={14} />

                    {isLive ? "LIVE" : "OFFLINE"}
                </div>

            </div>

        </>
    );
}
