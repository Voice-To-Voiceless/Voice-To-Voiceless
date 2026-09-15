import "./CommunicationGrid.css";

import CommunicationCard from "../CommunicationCard";

import type {
    CommunicationAction,
    CommunicationCardState,
} from "../types";

type CommunicationGridProps = {
    actions: CommunicationAction[];
    selectedActionId?: string | null;
    hoveredActionId?: string | null;
    progress?: number;
    onActionPress?: (action: CommunicationAction) => void;
};

export default function CommunicationGrid({
    actions,
    selectedActionId,
    hoveredActionId,
    progress = 0,
    onActionPress,
}: CommunicationGridProps) {
    const getCardState = (
        action: CommunicationAction
    ): CommunicationCardState => {
        if (selectedActionId === action.id) {
            return "selected";
        }

        if (hoveredActionId === action.id) {
            return "progress";
        }

        return "idle";
    };

    return (
        <div className="communication-grid">
            {actions.map((action) => (
                <CommunicationCard
                    key={action.id}
                    action={action}
                    state={getCardState(action)}
                    progress={
                        hoveredActionId === action.id
                            ? progress
                            : 0
                    }
                    onPress={() => onActionPress?.(action)}
                />
            ))}
        </div>
    );
}