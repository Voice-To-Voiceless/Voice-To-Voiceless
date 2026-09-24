import "../../../styles/components/layout/Sidebar.css";
import { useState, type FormEvent, type ReactNode } from "react";

import {
    House,
    Accessibility,
    IdCard,
    LockKeyhole,
    Settings,
    HeartPulse,
    X,
} from "lucide-react";
import { useLanguage } from "../../../i18n";

const DEMO_PATIENT_CODE = "VT-2026-001";
const DEMO_PATIENT_PASSWORD = "1234";

const items = [
    { icon: House, key: "home" as const, item: "Home" as const, active: true },
    { icon: Accessibility, key: "accessibility" as const, item: "Accessibility" as const },
    { icon: Settings, key: "settings" as const, item: "Settings" as const },
];

type SidebarProps = {
    notification?: ReactNode;
    activeItem?: "Home" | "Accessibility" | "Settings";
    onNavigate?: (item: "Home" | "Accessibility" | "Settings") => void;
};

export default function Sidebar({ notification, activeItem = "Home", onNavigate }: SidebarProps) {
    const { t } = useLanguage();
    const [showPatientCode, setShowPatientCode] = useState(false);
    const [password, setPassword] = useState("");
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [passwordError, setPasswordError] = useState(false);

    const openPatientCode = () => {
        setPassword("");
        setIsUnlocked(false);
        setPasswordError(false);
        setShowPatientCode(true);
    };

    const closePatientCode = () => {
        setShowPatientCode(false);
        setPassword("");
        setIsUnlocked(false);
        setPasswordError(false);
    };

    const unlockPatientCode = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const validPassword = password === DEMO_PATIENT_PASSWORD;
        setIsUnlocked(validPassword);
        setPasswordError(!validPassword);
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

                <button className="sidebar__item sidebar__patient-code-button" type="button" onClick={openPatientCode}>
                    <IdCard size={22} />
                    <span>Patient code</span>
                </button>

            </nav>

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

                    <div className="patient-code-modal__icon"><LockKeyhole size={22} /></div>
                    <p className="patient-code-modal__eyebrow">Patient access</p>
                    <h2 id="patient-code-title">Patient code</h2>

                    {!isUnlocked ? (
                        <form onSubmit={unlockPatientCode}>
                            <label className="patient-code-modal__label" htmlFor="patient-code-password">Enter password</label>
                            <input
                                id="patient-code-password"
                                className="patient-code-modal__input"
                                type="password"
                                value={password}
                                onChange={event => {
                                    setPassword(event.target.value);
                                    setPasswordError(false);
                                }}
                                autoFocus
                                autoComplete="off"
                            />
                            {passwordError && <p className="patient-code-modal__error" role="alert">Incorrect password.</p>}
                            <button className="patient-code-modal__submit" type="submit">Show patient code</button>
                        </form>
                    ) : (
                        <div className="patient-code-modal__result">
                            <span>Your patient code</span>
                            <strong>{DEMO_PATIENT_CODE}</strong>
                            <button className="patient-code-modal__submit" type="button" onClick={closePatientCode}>Done</button>
                        </div>
                    )}
                </section>
                </div>
            )}
        </>
    );
}