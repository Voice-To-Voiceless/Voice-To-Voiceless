import "./CameraPreview.css";

import type { CameraPreviewProps } from "./CameraPreview.types";

export default function CameraPreview({
    children,
}: CameraPreviewProps) {
    return (
        <div className="camera-preview">

            {children}

        </div>
    );
}