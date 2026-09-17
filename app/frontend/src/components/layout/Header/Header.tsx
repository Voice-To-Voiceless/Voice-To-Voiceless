import "./Header.css";

import { Camera, ChevronDown, Eye, UserRound } from "lucide-react";

type HeaderProps = {
    trackingActive?: boolean;
    recognitionActive?: boolean;
};

export default function Header({ trackingActive = false, recognitionActive = false }: HeaderProps) {
    const cameraActive = trackingActive || recognitionActive;

    return (
        <header className="app-header">
            <div className={`app-header__tracking${trackingActive ? " app-header__tracking--active" : ""}`}>
                <span className="app-header__status-dot" aria-hidden="true" />
                <Eye size={16} aria-hidden="true" />
                <span>{trackingActive ? "Eye tracking active" : "Eye tracking ready"}</span>
            </div>
            <div className="app-header__camera" aria-label="Camera status">
                <Camera size={16} aria-hidden="true" />
                <span>{cameraActive ? "Camera active" : "Camera off"}</span>
                <ChevronDown size={14} aria-hidden="true" />
            </div>
            <button type="button" className="app-header__account">
                <UserRound size={18} aria-hidden="true" />
                <span>Account</span>
            </button>
        </header>
    );
}
