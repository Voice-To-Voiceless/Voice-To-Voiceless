import "../../../styles/components/layout/AppLayout.css";

import Sidebar from "../Sidebar";

import type { AppLayoutProps } from "./AppLayout.types";

export default function AppLayout({
    children,
    sidebarNotification,
    sidebarControls,
    className = "",
    activeSidebarItem = "Home",
    onSidebarNavigate,
}: AppLayoutProps) {
    return (
        <div className={`app-layout ${className}`.trim()}>

            <Sidebar notification={sidebarNotification} controls={sidebarControls} activeItem={activeSidebarItem} onNavigate={onSidebarNavigate} />

            <main className="app-layout__content">

                {children}

            </main>

        </div>
    );
}