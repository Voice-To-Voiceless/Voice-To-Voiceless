import "./CameraPreview.css";

import { Camera } from "lucide-react";
import type { CameraPreviewProps } from "./CameraPreview.types";

export default function CameraPreview({
    children,
}: CameraPreviewProps) {
    return (
        <div className="camera-preview">

            {children || (
                <div className="camera-preview__placeholder">
                    <Camera size={60} />

                    <h2>Waiting for camera</h2>

                    <p>
                        Start Eye Tracking to begin.
                    </p>
                </div>
            )}
        </div>
    );
}