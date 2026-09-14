import "./CommunicationCard.css";

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
            className={`communication-card communication-card--${state}`}
            onClick={onPress}
            type="button"
        >
            <div
                className="communication-card__icon"
                style={{
                    color: action.color,
                }}
            >
                {action.icon}
            </div>

            <div className="communication-card__content">
                <h3 className="communication-card__title">
                    {action.title}
                </h3>

                <p className="communication-card__subtitle">
                    {action.subtitle}
                </p>
            </div>

            {state === "progress" && (
                <div className="communication-card__progress">
                    <div
                        className="communication-card__progress-fill"
                        style={{
                            width: `${progress}%`,
                        }}
                    />
                </div>
            )}
        </button>
    );
}