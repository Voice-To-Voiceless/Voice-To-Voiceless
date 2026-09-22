import "./Sidebar.css";
import type { ReactNode } from "react";

import {
    House,
    Accessibility,
    Settings,
    HeartPulse,
} from "lucide-react";

const items = [
    { icon: House, label: "Home", active: true },
    { icon: Accessibility, label: "Accessibility" },
    { icon: Settings, label: "Settings" },
];

type SidebarProps = {
    notification?: ReactNode;
    activeItem?: "Home" | "Accessibility" | "Settings";
    onNavigate?: (item: "Home" | "Accessibility" | "Settings") => void;
};

export default function Sidebar({ notification, activeItem = "Home", onNavigate }: SidebarProps) {
    return (
        <aside className="sidebar">

            <div className="sidebar__brand">

                <HeartPulse size={28} />

                <span>VoiceToVoiceless</span>

            </div>

            {notification}

            <nav className="sidebar__menu">

                {items.map(({ icon: Icon, label, active }) => (
                    <button
                        key={label}
                        className={`sidebar__item ${label === activeItem || (active && activeItem === "Home") ? "sidebar__item--active" : ""}`}
                        type="button"
                        onClick={() => onNavigate?.(label as "Home" | "Accessibility" | "Settings")}
                    >
                        <Icon size={22} />
                        <span>{label}</span>
                    </button>
                ))}

            </nav>

            <time className="sidebar__clock" dateTime={new Date().toISOString()}>
                <span>Current time</span>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </time>

        </aside>
    );
}