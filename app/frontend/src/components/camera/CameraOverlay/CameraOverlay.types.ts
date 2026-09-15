export interface CameraOverlayProps {
    isLive: boolean;
    fps: number;
    faceDetected: boolean;
    trackingActive: boolean;
    calibrationComplete: boolean;
    faceRecognitionActive: boolean;
    faceState: string;
    faceRisk: number;
    faceExpression: string;
    faceIndicators: string[];
}