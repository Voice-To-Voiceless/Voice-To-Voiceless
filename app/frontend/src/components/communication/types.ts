import { ReactNode } from "react";

export interface CommunicationAction {
    id: string;
    title: string;
    subtitle: string;
    color: string;
    icon: ReactNode;
}

export type CommunicationCardState =
    | "idle"
    | "hover"
    | "progress"
    | "selected"
    | "disabled";