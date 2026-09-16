import "./AppLayout.css";

import Sidebar from "../Sidebar";

import type { AppLayoutProps } from "./AppLayout.types";

export default function AppLayout({
    children,
    sidebarNotification,
}: AppLayoutProps) {
    return (
        <div className="app-layout">

            <Sidebar notification={sidebarNotification} />

            <main className="app-layout__content">

                {children}

            </main>

        </div>
    );
}