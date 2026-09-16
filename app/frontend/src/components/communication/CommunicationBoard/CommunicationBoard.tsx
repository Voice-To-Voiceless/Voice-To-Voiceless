import "./CommunicationBoard.css";

import { Check, Droplets, Siren, Toilet, UserRound, Utensils, X } from "lucide-react";
import type { ReactNode } from "react";

import CommunicationGrid from "../CommunicationGrid";
import SelectionAnimation from "../SelectionAnimation";
import SelectionProgress from "../SelectionProgress";

import type { CommunicationAction } from "../types";
import type { CommunicationBoardProps } from "./CommunicationBoard.types";

const actionIcons: Record<string, ReactNode> = {
    yes: <Check size={42} />,
    no: <X size={42} />,
    help: <UserRound size={42} />,
    emergency: <Siren size={42} />,
    water: <Droplets size={42} />,
    food: <Utensils size={42} />,
    bathroom: <Toilet size={42} />,
    nurse: <UserRound size={42} />,
};

const actionColors: Record<string, string> = {
    yes: "#27AE60",
    no: "#94A3B8",
    help: "#F2C94C",
    emergency: "#EB5757",
    water: "#2F80ED",
    food: "#F2994A",
    bathroom: "#9B51E0",
    nurse: "#2D9CDB",
};

function toCommunicationAction(action: CommunicationBoardProps["actions"][number]): CommunicationAction {
    return {
        id: action.id,
        title: action.label,
        subtitle: action.description,
        color: actionColors[action.id],
        icon: actionIcons[action.id],
    };
}

export default function CommunicationBoard({
    actions,
    boardRef,
    activeTarget,
    selectedAction,
    dwellProgress,
    onActionSelect,
}: CommunicationBoardProps) {
    const communicationActions = actions.map(toCommunicationAction);
        const dwellProgressPercentage = dwellProgress * 100;

    return (
        <div ref={boardRef} className="communication-board">
            <CommunicationGrid
                actions={communicationActions}
                hoveredActionId={activeTarget}
                selectedActionId={selectedAction}
                    progress={dwellProgressPercentage}
                onActionPress={(action) => {
                    const selected = actions.find((item) => item.id === action.id);
                    if (selected) {
                        onActionSelect(selected);
                    }
                }}
            />

            <SelectionProgress
                title={communicationActions.find((action) => action.id === selectedAction)?.title ?? ""}
                    progress={dwellProgressPercentage}
                visible={selectedAction !== null}
            />

            <SelectionAnimation
                visible={selectedAction !== null}
                message={selectedAction ? "Action selected" : ""}
            />
        </div>
    );
}
