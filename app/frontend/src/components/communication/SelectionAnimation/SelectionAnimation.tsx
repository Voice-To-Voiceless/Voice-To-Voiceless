import "../../../styles/components/communication/SelectionAnimation.css";

type SelectionAnimationProps = {
    visible: boolean;
    message: string;
};

export default function SelectionAnimation({
    visible,
    message,
}: SelectionAnimationProps) {
    if (!visible) {
        return null;
    }

    return (
        <div className="selection-animation">
            ✓ {message}
        </div>
    );
}