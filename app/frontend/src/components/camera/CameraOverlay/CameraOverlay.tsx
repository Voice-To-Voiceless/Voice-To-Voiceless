import "./CameraOverlay.css";

import {
    Camera,
    CircleCheck,
    Eye,
    Radio,
} from "lucide-react";

import type { CameraOverlayProps } from "./CameraOverlay.types";

export default function CameraOverlay({
    isLive,
    fps: _fps,
    faceDetected,
    trackingActive,
    calibrationComplete,
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

            <div className="camera-overlay__status">

                <StatusItem
                    icon={<Camera size={18} />}
                    label={
                        faceDetected
                            ? "Face Detected"
                            : "No Face"
                    }
                    active={faceDetected}
                />

                <StatusItem
                    icon={<Eye size={18} />}
                    label={
                        trackingActive
                            ? "Eye Tracking"
                            : "Tracking Off"
                    }
                    active={trackingActive}
                />

                <StatusItem
                    icon={<CircleCheck size={18} />}
                    label={
                        calibrationComplete
                            ? "Calibration Ready"
                            : "Calibration Required"
                    }
                    active={calibrationComplete}
                />

            </div>
        </>
    );
}

type StatusItemProps = {
    icon: React.ReactNode;
    label: string;
    active: boolean;
};

function StatusItem({
    icon,
    label,
    active,
}: StatusItemProps) {
    return (
        <div
            className={`camera-overlay__status-item ${
                active
                    ? "camera-overlay__status-item--active"
                    : ""
            }`}
        >
            {icon}

            <span>{label}</span>
        </div>
    );
}