import type { RefObject } from "react";

import type { ActionDefinition } from "../../../types/communication";

export interface CommunicationBoardProps {
    actions: ActionDefinition[];

    boardRef: RefObject<HTMLDivElement | null>;

    activeTarget: string | null;

    selectedAction: string | null;

    dwellProgress: number;

    onActionSelect: (action: ActionDefinition) => void;
}