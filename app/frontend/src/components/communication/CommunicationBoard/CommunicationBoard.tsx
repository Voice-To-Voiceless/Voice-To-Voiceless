import "../../../styles/components/communication/CommunicationBoard.css";

import { BedDouble, Check, Droplets, Frown, MessageCircle, Pill, Toilet, Utensils, X } from "lucide-react";
import type { ReactNode } from "react";

import CommunicationGrid from "../CommunicationGrid";

import type { CommunicationAction } from "../types";
import type { CommunicationBoardProps } from "./CommunicationBoard.types";

const actionIcons: Record<string, ReactNode> = {
    yes: <Check size={42} />,
    no: <X size={42} />,
    bathroom: <Toilet size={42} />,
    food: <Utensils size={42} />,
    water: <Droplets size={42} />,
    medication: <Pill size={42} />,
    pain: <Frown size={42} />,
    sleep: <BedDouble size={42} />,
    talk: <MessageCircle size={42} />,
};

const actionColors: Record<string, string> = {
    yes: "#27AE60",
    no: "#f3a6b2",
    bathroom: "#9B51E0",
    food: "#F2994A",
    water: "#2F80ED",
    medication: "#2D9CDB",
    pain: "#D4A72C",
    sleep: "#527A9E",
    talk: "#C45A9A",
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
    const boardActions = Array.from({ length: 9 }, (_, index) => communicationActions[index] ?? null);
        const dwellProgressPercentage = dwellProgress * 100;

    return (
        <div ref={boardRef} className="communication-board">
            <CommunicationGrid
                actions={boardActions}
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

        </div>
    );
}
