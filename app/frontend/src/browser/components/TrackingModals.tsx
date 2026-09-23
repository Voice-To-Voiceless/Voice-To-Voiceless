import React from 'react';
import { Bell, Camera, CheckCircle2, Eye, EyeOff, ScanFace, X } from 'lucide-react';
import CameraPreview from '../../components/camera/CameraPreview';
import { CameraPanel } from '../../components/camera/CameraPanel';
import { useBrowserTracking } from '../hooks/useBrowserTracking';
import { useFaceRecognition } from '../hooks/useFaceRecognition';
import { useLanguage } from '../../i18n';

type Tracking = ReturnType<typeof useBrowserTracking>;
type Recognition = ReturnType<typeof useFaceRecognition>;
type Translator = ReturnType<typeof useLanguage>['t'];

export function TrackingGuideModal({ t, onClose, onBegin }: { t: Translator; onClose: () => void; onBegin: () => void }) {
  return <section className="tracking-guide-modal" role="dialog" aria-modal="true" aria-labelledby="tracking-guide-title">
    <div className="tracking-guide-modal__content">
      <button type="button" className="tracking-guide-modal__close" aria-label={t('close')} title={t('close')} onClick={onClose}><X size={20} aria-hidden="true" /></button>
      <div className="tracking-guide-modal__icon" aria-hidden="true"><ScanFace size={28} /></div>
      <p className="eyebrow">{t('startEyeTracking')}</p>
      <h2 id="tracking-guide-title">{t('eyeTrackingGuideTitle')}</h2>
      <p className="tracking-guide-modal__description">{t('eyeTrackingGuideDescription')}</p>
      <div className="tracking-guide-modal__rules">
        <GuideRule icon={<ScanFace size={18} />} text={t('eyeTrackingGuideCentered')} />
        <GuideRule icon={<Eye size={18} />} text={t('eyeTrackingGuideEyesVisible')} />
        <GuideRule icon={<EyeOff size={18} />} text={t('eyeTrackingGuideFollowTarget')} />
        <GuideRule icon={<CheckCircle2 size={18} />} text={t('eyeTrackingGuideHoldStill')} />
      </div>
      <div className="tracking-guide-modal__actions">
        <button type="button" className="tracking-guide-modal__cancel" onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="tracking-guide-modal__start" onClick={onBegin}>{t('beginCalibration')}</button>
      </div>
    </div>
  </section>;
}

export function CalibrationModal({ tracking, recognition, videoRef, faceDetected, trackingActive, recognitionActive, t }: {
  tracking: Tracking;
  recognition: Recognition;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  faceDetected: boolean;
  trackingActive: boolean;
  recognitionActive: boolean;
  t: Translator;
}) {
  const isCalibration = tracking.snapshot.calibrationTarget !== null || tracking.snapshot.calibrating || tracking.snapshot.calibrationFailed;
  return <section className={`calibration-modal${isCalibration || recognitionActive ? '' : ' calibration-modal--hidden'}`} role="dialog" aria-modal="true" aria-label={tracking.snapshot.calibrating ? t('cameraCalibration') : t('faceRecognition')}>
    <div className="calibration-modal__content">
      <button type="button" className="calibration-modal__close" aria-label={t('closeCameraPopup')} title={t('close')} onClick={isCalibration ? tracking.cancelCalibration : recognition.stop}><X size={20} aria-hidden="true" /></button>
      <div className="calibration-modal__body">
        <div className="calibration-modal__preview"><CameraPanel isLive={trackingActive || recognitionActive} fps={60}><CameraPreview><video ref={videoRef} className="camera-preview" autoPlay muted playsInline /></CameraPreview></CameraPanel></div>
        {recognitionActive ? <aside className="camera-status-sidebar camera-status-sidebar--details" aria-label={t('faceRecognition')}>
          <strong>{t('faceRecognition')}</strong>
          <StatusDetail label={t('state')} value={recognition.snapshot.state} />
          <StatusDetail label={t('risk')} value={recognition.snapshot.risk.toFixed(2)} />
          <StatusDetail label={t('expression')} value={recognition.snapshot.expression} />
          <StatusDetail label={t('indicators')} value={recognition.snapshot.indicators.length > 0 ? recognition.snapshot.indicators.join(', ') : t('none')} />
        </aside> : <aside className="camera-status-sidebar" aria-label={t('eyeTrackingReady')}>
          <StatusItem icon={<Camera size={16} />} label={faceDetected ? t('faceDetected') : t('noFaceDetected')} active={faceDetected} />
          <StatusItem icon={<Eye size={16} />} label={trackingActive ? t('eyeTrackingActive') : t('eyeTrackingOff')} active={trackingActive} />
          <StatusItem icon={<CheckCircle2 size={16} />} label={tracking.snapshot.calibrationReady ? t('calibrationReady') : t('calibrationRequired')} active={tracking.snapshot.calibrationReady} />
        </aside>}
      </div>
      <div className="calibration-modal__progress" aria-live="polite">
        {(tracking.snapshot.calibrating || tracking.snapshot.calibrationFailed) && <span>{tracking.snapshot.calibrationIndex + 1}/9</span>}
        <strong>{recognitionActive ? t('faceRecognitionLive') : tracking.status}</strong>
        {tracking.snapshot.calibrationFailed && <div className="calibration-modal__actions"><button type="button" onClick={tracking.calibrate}>{t('retry')}</button><button type="button" onClick={tracking.cancelCalibration}>{t('cancel')}</button></div>}
      </div>
    </div>
  </section>;
}

function StatusItem({ icon, label, active }: { icon: React.ReactNode; label: string; active: boolean }) {
  return <div className={`camera-status-sidebar__item${active ? ' camera-status-sidebar__item--active' : ''}`}>{icon}<span>{label}</span></div>;
}

function StatusDetail({ label, value }: { label: string; value: string }) {
  return <div className="camera-status-sidebar__detail"><span>{label}</span><strong>{value}</strong></div>;
}

function GuideRule({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="tracking-guide-modal__rule">{icon}<span>{text}</span></div>;
}

export function NotificationIcon() {
  return <Bell size={22} aria-hidden="true" />;
}

export function NurseAlertPopup({ message, t, replying, onReply }: { message: string; t: Translator; replying: boolean; onReply: (message: string) => void }) {
  return <section className="patient-notification-popup" role="dialog" aria-modal="true" aria-labelledby="patient-notification-title">
    <div className="patient-notification-popup__icon"><NotificationIcon /></div>
    <span className="patient-notification-popup__eyebrow">{t('messageFromNurse')}</span>
    <h2 id="patient-notification-title">{message}</h2>
    <p>{t('chooseReply')}</p>
    <div className="patient-notification-popup__actions">
      <button type="button" onClick={() => onReply(`${t('needHelp')}.`)} disabled={replying}>{t('needHelp')}</button>
      <button type="button" onClick={() => onReply(`${t('understood')}.`)} disabled={replying}>{t('understood')}</button>
      <button type="button" onClick={() => onReply(`${t('later')}.`)} disabled={replying}>{t('later')}</button>
    </div>
  </section>;
}