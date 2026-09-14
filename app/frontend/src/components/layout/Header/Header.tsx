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

        </header>
    );
}