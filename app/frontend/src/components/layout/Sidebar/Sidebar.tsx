import "../../../styles/components/layout/Sidebar.css";
import { useEffect, useState, type ReactNode } from "react";

import {
    House,
    Accessibility,
    IdCard,
    Keyboard,
    QrCode,
    Settings,
    HeartPulse,
    X,
} from "lucide-react";
import QRCode from "qrcode";
import { useLanguage } from "../../../i18n";

const DEMO_PATIENT_CODE = "VT-2026-001";

const items = [
    { icon: House, key: "home" as const, item: "Home" as const, active: true },
    { icon: Accessibility, key: "accessibility" as const, item: "Accessibility" as const },
    { icon: Settings, key: "settings" as const, item: "Settings" as const },
];

type SidebarProps = {
    notification?: ReactNode;
    controls?: ReactNode;
    activeItem?: "Home" | "Accessibility" | "Settings";
    onNavigate?: (item: "Home" | "Accessibility" | "Settings") => void;
};

export default function Sidebar({ notification, controls, activeItem = "Home", onNavigate }: SidebarProps) {
    const { t } = useLanguage();
    const [showPatientCode, setShowPatientCode] = useState(false);
    const [showManualCode, setShowManualCode] = useState(false);
    const [qrCode, setQrCode] = useState("");

    useEffect(() => {
        if (!showPatientCode) return;

        let cancelled = false;
        QRCode.toDataURL(DEMO_PATIENT_CODE, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 220,
        }).then(dataUrl => {
            if (!cancelled) setQrCode(dataUrl);
        });

        return () => {
            cancelled = true;
        };
    }, [showPatientCode]);

    const openPatientCode = () => {
        setShowManualCode(false);
        setShowPatientCode(true);
    };

    const closePatientCode = () => {
        setShowPatientCode(false);
        setShowManualCode(false);
        setQrCode("");
    };

    return (
        <>
            <aside className="sidebar">

            <div className="sidebar__brand">

                <HeartPulse size={28} />

                <span>VoiceToVoiceless</span>

            </div>

            {notification}

            <nav className="sidebar__menu">

                {items.map(({ icon: Icon, key, item, active }) => (
                    <button
                        key={item}
                        className={`sidebar__item ${item === activeItem || (active && activeItem === "Home") ? "sidebar__item--active" : ""}`}
                        type="button"
                        onClick={() => onNavigate?.(item)}
                    >
                        <Icon size={22} />
                        <span>{t(key)}</span>
                    </button>
                ))}

            </nav>

            {controls && <div className="sidebar__controls">{controls}</div>}

            <button className="sidebar__item sidebar__patient-code-button" type="button" onClick={openPatientCode}>
                <IdCard size={22} />
                <span>{t("patientCode")}</span>
            </button>

            <time className="sidebar__clock" dateTime={new Date().toISOString()}>
                <span>{t("currentTime")}</span>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </time>

            </aside>

            {showPatientCode && (
                <div className="patient-code-modal" role="presentation" onMouseDown={closePatientCode}>
                <section
                    className="patient-code-modal__content"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="patient-code-title"
                    onMouseDown={event => event.stopPropagation()}
                >
                    <button className="patient-code-modal__close" type="button" aria-label="Close" onClick={closePatientCode}>
                        <X size={20} />
                    </button>

                    <h2 id="patient-code-title">{t("patientCode")}</h2>

                    {!showManualCode ? (
                        <div className="patient-code-modal__qr-result">
                            <span>{t("scanQrCode")}</span>
                            <div className="patient-code-modal__qr-frame" aria-label={`QR code for ${DEMO_PATIENT_CODE}`}>
                                {qrCode ? <img src={qrCode} alt={`QR code for patient ${DEMO_PATIENT_CODE}`} /> : <QrCode size={120} />}
                            </div>
                            <button className="patient-code-modal__manual" type="button" onClick={() => setShowManualCode(true)}>
                                <Keyboard size={17} />
                                {t("enterManualCode")}
                            </button>
                        </div>
                    ) : (
                        <div className="patient-code-modal__result">
                            <span>{t("yourPatientCode")}</span>
                            <strong>{DEMO_PATIENT_CODE}</strong>
                            <button className="patient-code-modal__submit" type="button" onClick={closePatientCode}>{t("done")}</button>
                        </div>
                    )}
                </section>
                </div>
            )}
        </>
    );
}
