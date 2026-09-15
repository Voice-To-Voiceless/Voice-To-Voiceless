import { ReactNode } from "react";

export interface CameraPanelProps {
    isLive: boolean;
    fps: number;
    children?: ReactNode;
}