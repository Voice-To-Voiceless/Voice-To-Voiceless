import "./Badge.css";

import type { BadgeProps } from "./Badge.types";

export default function Badge({
    icon,
    label,
    variant = "neutral",
}: BadgeProps) {
    return (
        <div className={`badge badge--${variant}`}>
            <span className="badge__icon">
                {icon}
            </span>

            <span className="badge__label">
                {label}
            </span>
        </div>
    );
}