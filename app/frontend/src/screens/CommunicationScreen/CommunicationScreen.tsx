import "./CommunicationScreen.css";

import Header from "../../components/layout/Header";
import { CameraPanel } from "../../components/camera/CameraPanel";
import CommunicationBoard from "../../components/communication/CommunicationBoard";
import TrackingPanel from "../../components/tracking/TrackingPanel";

export default function CommunicationScreen() {
    return (
        <div className="communication-screen">

            <Header />

            <main className="communication-screen__main">

                <section className="communication-screen__top">

                    <CameraPanel
                        isLive
                        fps={60}
                    />

                    <CommunicationBoard />

                </section>

                <section className="communication-screen__bottom">

                    <TrackingPanel />

                    <div className="communication-screen__placeholder">
                        Patient Status
                    </div>

                </section>

            </main>

            <footer className="communication-screen__footer">

                VoiceToVoiceless © 2026

            </footer>

        </div>
    );
}