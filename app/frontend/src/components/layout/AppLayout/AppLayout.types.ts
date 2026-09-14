import { RefObject } from "react";

export interface AppLayoutProps {
    children?: React.ReactNode;

    videoRef: RefObject<HTMLVideoElement | null>;

    boardRef: RefObject<HTMLDivElement | null>;
}