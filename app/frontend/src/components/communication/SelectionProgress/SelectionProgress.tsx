import "../../../styles/components/communication/SelectionProgress.css";

type SelectionProgressProps = {
    title: string;
    progress: number;
    visible: boolean;
};

export default function SelectionProgress({
    title,
    progress,
    visible,
}: SelectionProgressProps) {
    if (!visible) {
        return null;
    }

    return (
        <section className="selection-progress">
            <span className="selection-progress__label">
                Looking at
            </span>

            <h2 className="selection-progress__title">
                {title}
            </h2>

            <div className="selection-progress__bar">
                <div
                    className="selection-progress__fill"
                    style={{
                        width: `${progress}%`,
                    }}
                />
            </div>

            <span className="selection-progress__percentage">
                {progress.toFixed(0)}%
            </span>

            <p className="selection-progress__hint">
                Keep looking to confirm your selection
            </p>
        </section>
    );
}