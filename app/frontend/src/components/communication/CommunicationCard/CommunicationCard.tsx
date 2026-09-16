import "./CommunicationCard.css";

import { Check } from "lucide-react";

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

                    <svg viewBox="0 0 100 100">

                        <circle
                            cx="50"
                            cy="50"
                            r="42"
                            className="communication-card__progress-background"
                        />

                        <circle
                            cx="50"
                            cy="50"
                            r="42"
                            className="communication-card__progress-value"
                            style={{
                                strokeDashoffset:
                                    264 - (264 * progress) / 100,
                            }}
                        />

                    </svg>

                    <span>

                        {progress.toFixed(0)}%

                    </span>

                </div>
            )}
        </button>
    );
}