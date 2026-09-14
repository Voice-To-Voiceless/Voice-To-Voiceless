import "./Header.css";

import {
    Eye,
    Settings,
    Target,
    UserRound,
    HeartPulse,
} from "lucide-react";

import Badge from "../../badge";

export default function Header() {
    return (
        <header className="app-header">

            <div className="app-header__brand">

                <div className="app-header__logo">

                    <HeartPulse size={34} />

                </div>

                <div>

                    <h1 className="app-header__title">
                        VoiceToVoiceless
                    </h1>

                    <p className="app-header__subtitle">
                        Patient Communication Assistant
                    </p>

                </div>

            </div>

            <div className="app-header__actions">

                <Badge
                    icon={<Eye size={18} />}
                    label="Tracking Active"
                    variant="success"
                />

                <Badge
                    icon={<Target size={18} />}
                    label="Calibration"
                    variant="info"
                />

                <Badge
                    icon={<Settings size={18} />}
                    label="Settings"
                />

                <Badge
                    icon={<UserRound size={18} />}
                    label="Patient 204"
                />

            </div>

        </header>
    );
}