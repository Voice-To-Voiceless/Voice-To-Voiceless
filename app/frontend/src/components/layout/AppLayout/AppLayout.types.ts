import { ReactNode, RefObject } from "react";

export interface AppLayoutProps{
    children:ReactNode;
    sidebarNotification?: ReactNode;
    videoRef?: RefObject<HTMLVideoElement | null>;
    boardRef?: RefObject<HTMLDivElement | null>;
}