import "./CommunicationCard.css";

import { Check } from "lucide-react";
import type { CSSProperties } from "react";

import type {
    CommunicationAction,
    CommunicationCardState,
} from "../types";

type CommunicationCardProps = {
    action: CommunicationAction;
    state: CommunicationCardState;
    progress?: number;
    onPress?: () => void;
};

export default function CommunicationCard({
    action,
    state,
    progress = 0,
    onPress,
}: CommunicationCardProps) {
    return (
        <button
            type="button"
            className={`communication-card communication-card--${state}`}
            data-action-id={action.id}
            style={{ "--action-color": action.color } as CSSProperties}
            onClick={onPress}
        >
            {state === "selected" && (
                <div className="communication-card__selected">
                    <Check size={18} />
                </div>
            )}

            <div
                className="communication-card__icon"
                style={{
                    color: action.color,
                }}
            >
                {action.icon}
            </div>

           <h2 className="communication-card__title">
    {action.title}
</h2>
            {state === "progress" && (
                <div className="communication-card__progress">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                        <rect
                            x="1.5"
                            y="1.5"
                            width="97"
                            height="97"
                            rx="9"
                            pathLength="1"
                            className="communication-card__progress-background"
                        />
                        <rect
                            x="1.5"
                            y="1.5"
                            width="97"
                            height="97"
                            rx="9"
                            pathLength="1"
                            className="communication-card__progress-value"
                            style={{ strokeDashoffset: 1 - progress / 100 }}
                        />
                    </svg>
                </div>
            )}
        </button>
    );
}