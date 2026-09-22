import { ReactNode } from "react";

export interface AppLayoutProps{
    children:ReactNode;
    sidebarNotification?: ReactNode;
    className?: string;
}