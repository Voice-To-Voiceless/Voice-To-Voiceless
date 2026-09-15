import "./AppLayout.css";

import type { AppLayoutProps } from "./AppLayout.types";

export default function AppLayout({
    children,
}: AppLayoutProps) {
    return (
        <div className="app-layout">

            {children}

        </div>
    );
}