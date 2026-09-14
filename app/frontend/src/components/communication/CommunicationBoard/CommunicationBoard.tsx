import "./CommunicationBoard.css";

import { Check, Droplets, Siren, Toilet, UserRound, Utensils, X } from "lucide-react";

import CommunicationGrid from "../CommunicationGrid";
import SelectionAnimation from "../SelectionAnimation";
import SelectionProgress from "../SelectionProgress";

import type { CommunicationAction } from "../types";

const actions: CommunicationAction[] = [
    {
        id: "yes",
        title: "Yes",
        subtitle: "I agree",
        color: "#27AE60",
        icon: <Check size={42} />,
    },
    {
        id: "no",
        title: "No",
        subtitle: "I disagree",
        color: "#94A3B8",
        icon: <X size={42} />,
    },
    {
        id: "help",
        title: "Help",
        subtitle: "Need assistance",
        color: "#F2C94C",
        icon: <UserRound size={42} />,
    },
    {
        id: "emergency",
        title: "Emergency",
        subtitle: "Immediate help",
        color: "#EB5757",
        icon: <Siren size={42} />,
    },
    {
        id: "water",
        title: "Water",
        subtitle: "I need a drink",
        color: "#2F80ED",
        icon: <Droplets size={42} />,
    },
    {
        id: "food",
        title: "Food",
        subtitle: "I am hungry",
        color: "#F2994A",
        icon: <Utensils size={42} />,
    },
    {
        id: "bathroom",
        title: "Bathroom",
        subtitle: "Need the bathroom",
        color: "#9B51E0",
        icon: <Toilet size={42} />,
    },
    {
        id: "nurse",
        title: "Nurse",
        subtitle: "Call the nurse",
        color: "#2D9CDB",
        icon: <UserRound size={42} />,
    },
];

export default function CommunicationBoard() {
    return (
        <section className="communication-board">
            <CommunicationGrid
                actions={actions}
                hoveredActionId="help"
                progress={72}
            />

            <SelectionProgress
                title="Help"
                progress={72}
                visible
            />

            <SelectionAnimation
                visible={false}
                message="Help selected"
            />
        </section>
    );
}