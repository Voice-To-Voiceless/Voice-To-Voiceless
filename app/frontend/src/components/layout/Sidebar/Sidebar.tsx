import "../../../styles/components/layout/Sidebar.css";
import type { ReactNode } from "react";

import {
    House,
    Accessibility,
    Settings,
    HeartPulse,
} from "lucide-react";
import { useLanguage } from "../../../i18n";

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

    return (
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

            <time className="sidebar__clock" dateTime={new Date().toISOString()}>
                <span>{t("currentTime")}</span>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </time>

        </aside>
    );
}