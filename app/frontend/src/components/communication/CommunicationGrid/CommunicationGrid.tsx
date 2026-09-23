import "../../../styles/components/communication/CommunicationGrid.css";

import CommunicationCard from "../CommunicationCard";

import type {
    CommunicationAction,
    CommunicationCardState,
} from "../types";

type CommunicationGridProps = {
    actions: Array<CommunicationAction | null>;
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
        action: CommunicationAction | null
    ): CommunicationCardState => {
        if (!action) {
            return "idle";
        }

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
            {actions.map((action, index) => (
                action ? <CommunicationCard
                    key={action.id}
                    action={action}
                    state={getCardState(action)}
                    progress={
                        hoveredActionId === action.id
                            ? progress
                            : 0
                    }
                    onPress={() => onActionPress?.(action)}
                /> : <div className="communication-card communication-card--empty" key={`empty-${index}`} aria-hidden="true" />
            ))}
        </div>
    );
}