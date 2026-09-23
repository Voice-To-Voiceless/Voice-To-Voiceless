import "../../../styles/components/layout/Header.css";

import { Camera, ChevronDown, Eye, UserRound } from "lucide-react";
import { useLanguage } from "../../../i18n";

type HeaderProps = {
    trackingActive?: boolean;
    recognitionActive?: boolean;
};

export default function Header({ trackingActive = false, recognitionActive = false }: HeaderProps) {
    const cameraActive = trackingActive || recognitionActive;
    const { t } = useLanguage();

    return (
        <header className="app-header">
            <div className={`app-header__tracking${trackingActive ? " app-header__tracking--active" : ""}`}>
                <span className="app-header__status-dot" aria-hidden="true" />
                <Eye size={16} aria-hidden="true" />
                <span>{trackingActive ? t("eyeTrackingActive") : t("eyeTrackingReady")}</span>
            </div>
            <div className="app-header__camera" aria-label={t("camera")}>
                <Camera size={16} aria-hidden="true" />
                <span>{cameraActive ? t("cameraActive") : t("cameraOff")}</span>
                <ChevronDown size={14} aria-hidden="true" />
            </div>
            <button type="button" className="app-header__account">
                <UserRound size={18} aria-hidden="true" />
                <span>{t("account")}</span>
            </button>
        </header>
    );
}
