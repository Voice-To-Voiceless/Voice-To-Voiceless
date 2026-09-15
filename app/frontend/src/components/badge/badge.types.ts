import { ReactNode } from "react";

export interface BadgeProps {
    icon: ReactNode;
    label: string;
    variant?: "success" | "info" | "neutral";
}