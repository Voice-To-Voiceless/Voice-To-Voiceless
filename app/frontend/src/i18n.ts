import { useEffect, useState } from 'react';

export type Language = 'English' | 'Romanian';

type TranslationKey =
  | 'home'
  | 'accessibility'
  | 'settings'
  | 'currentTime'
  | 'personalizedExperience'
  | 'accessibilityDescription'
  | 'reset'
  | 'visual'
  | 'visualDescription'
  | 'textSize'
  | 'highContrast'
  | 'highContrastDescription'
  | 'reduceMotion'
  | 'reduceMotionDescription'
  | 'feedback'
  | 'feedbackDescription'
  | 'audioFeedback'
  | 'audioFeedbackDescription'
  | 'testAudioFeedback'
  | 'audioFeedbackActive'
  | 'preferencesSaved'
  | 'appConfiguration'
  | 'settingsDescription'
  | 'resetAppSettings'
  | 'language'
  | 'languageDescription'
  | 'appearance'
  | 'appearanceDescription'
  | 'darkMode'
  | 'showTargetIndicator'
  | 'debugOverlay'
  | 'debugOverlayDescription'
  | 'camera'
  | 'cameraDescription'
  | 'defaultCamera'
  | 'selectCamera'
  | 'checkCameraPermission'
  | 'cameraPermissionNotChecked'
  | 'cameraUnavailable'
  | 'cameraAvailable'
  | 'noCameraDetected'
  | 'cameraPermissionGranted'
  | 'cameraPermissionDenied'
  | 'cameraNotSupported'
  | 'communicationBoard'
  | 'communicationBoardDescription'
  | 'settingsSaved'
  | 'eyeTrackingActive'
  | 'eyeTrackingReady'
  | 'cameraActive'
  | 'cameraOff'
  | 'account'
  | 'faceDetected'
  | 'noFaceDetected'
  | 'eyeTrackingOff'
  | 'calibrationReady'
  | 'calibrationRequired'
  | 'faceRecognition'
  | 'state'
  | 'risk'
  | 'expression'
  | 'indicators'
  | 'none'
  | 'cameraCalibration'
  | 'closeCameraPopup'
  | 'close'
  | 'faceRecognitionLive'
  | 'retry'
  | 'cancel'
  | 'stopEyeTracking'
  | 'startEyeTracking'
  | 'eyeTrackingGuideTitle'
  | 'eyeTrackingGuideDescription'
  | 'eyeTrackingGuideCentered'
  | 'eyeTrackingGuideEyesVisible'
  | 'eyeTrackingGuideFollowTarget'
  | 'eyeTrackingGuideHoldStill'
  | 'beginCalibration'
  | 'stopFaceRecognition'
  | 'testFaceRecognition'
  | 'calibrating'
  | 'recalibrateGaze'
  | 'calibrateGaze'
  | 'footerNote'
  | 'messageFromNurse'
  | 'chooseReply'
  | 'needHelp'
  | 'understood'
  | 'later'
  | 'yes'
  | 'no'
  | 'bathroom'
  | 'food'
  | 'water'
  | 'medication'
  | 'pain'
  | 'sleep'
  | 'talk';

type Dictionary = Record<TranslationKey, string>;

const english: Dictionary = {
  home: 'Home', accessibility: 'Accessibility', settings: 'Settings', currentTime: 'Current time',
  personalizedExperience: 'PERSONALIZED EXPERIENCE', accessibilityDescription: 'Choose how the app helps you communicate more easily.', reset: 'Reset', visual: 'Visual', visualDescription: 'Make the interface easier to follow.', textSize: 'Text size', highContrast: 'High contrast', highContrastDescription: 'Increase the difference between text and background.', reduceMotion: 'Reduce motion', reduceMotionDescription: 'Keep transitions simple and subtle.', feedback: 'Feedback', feedbackDescription: 'Receive confirmation when you take an action.', audioFeedback: 'Audio feedback', audioFeedbackDescription: 'Play a sound when an option is selected.', testAudioFeedback: 'Test audio feedback', audioFeedbackActive: 'Audio feedback is active', preferencesSaved: 'Your preferences are saved automatically on this device.',
  appConfiguration: 'APP CONFIGURATION', settingsDescription: 'Configure the language, appearance, devices, and communication board.', resetAppSettings: 'Reset app settings', language: 'Language', languageDescription: 'Choose the language used by the application.', appearance: 'Appearance', appearanceDescription: 'Choose the visual theme for the application.', darkMode: 'Dark mode', showTargetIndicator: 'Show target indicator', debugOverlay: 'Debug overlay', debugOverlayDescription: 'Show live gaze and calibration diagnostics during development.', camera: 'Camera', cameraDescription: 'Manage the camera used for tracking.', defaultCamera: 'Default camera', selectCamera: 'Select camera', checkCameraPermission: 'Check camera permission', cameraPermissionNotChecked: 'Camera permission has not been checked.', cameraUnavailable: 'Unable to inspect available cameras.', cameraAvailable: 'Camera available.', noCameraDetected: 'No camera detected.', cameraPermissionGranted: 'Camera permission granted.', cameraPermissionDenied: 'Camera permission was denied.', cameraNotSupported: 'Camera access is not supported in this browser.', communicationBoard: 'Communication board', communicationBoardDescription: 'Choose which actions appear on the board.', settingsSaved: 'Your settings are saved automatically on this device.',
  eyeTrackingActive: 'Eye tracking active', eyeTrackingReady: 'Eye tracking ready', cameraActive: 'Camera active', cameraOff: 'Camera off', account: 'Account', faceDetected: 'Face detected', noFaceDetected: 'No face detected', eyeTrackingOff: 'Eye tracking off', calibrationReady: 'Calibration ready', calibrationRequired: 'Calibration required', faceRecognition: 'Face recognition', state: 'State', risk: 'Risk', expression: 'Expression', indicators: 'Indicators', none: 'None', cameraCalibration: 'Camera calibration', closeCameraPopup: 'Close camera popup', close: 'Close', faceRecognitionLive: 'Face recognition is live.', retry: 'Retry', cancel: 'Cancel', stopEyeTracking: 'Stop eye tracking', startEyeTracking: 'Start eye tracking', eyeTrackingGuideTitle: 'Before eye tracking starts', eyeTrackingGuideDescription: 'Follow these simple rules during calibration so the tracking stays reliable.', eyeTrackingGuideCentered: 'Keep your face centered in the camera view.', eyeTrackingGuideEyesVisible: 'Keep both eyes open and visible.', eyeTrackingGuideFollowTarget: 'Follow the colored dot with your eyes.', eyeTrackingGuideHoldStill: 'Hold your gaze steady until each point is complete.', beginCalibration: 'Begin calibration', stopFaceRecognition: 'Stop face recognition', testFaceRecognition: 'Test live monitoring', calibrating: 'Calibrating', recalibrateGaze: 'Recalibrate gaze', calibrateGaze: 'Calibrate gaze', footerNote: 'Assistive communication prototype. Touch remains available at all times.', messageFromNurse: 'Message from nurse', chooseReply: 'Choose a reply for the nurse.', needHelp: 'I need help', understood: 'I understood', later: 'Later',
  yes: 'Yes', no: 'No', bathroom: 'Bathroom', food: 'Food', water: 'Water', medication: 'Medication', pain: 'Pain', sleep: 'Sleep', talk: 'Talk to someone',
};

const romanian: Dictionary = {
  ...english,
  home: 'Acasa', accessibility: 'Accesibilitate', settings: 'Setari', currentTime: 'Ora curenta', personalizedExperience: 'EXPERIENTA PERSONALIZATA', accessibilityDescription: 'Alege cum te ajuta aplicatia sa comunici mai usor.', reset: 'Reseteaza', visual: 'Vizual', visualDescription: 'Fa interfata mai usor de urmarit.', textSize: 'Dimensiunea textului', highContrast: 'Contrast ridicat', highContrastDescription: 'Mareste diferenta dintre text si fundal.', reduceMotion: 'Reducerea animatiilor', reduceMotionDescription: 'Pastreaza tranzitiile simple si discrete.', feedback: 'Feedback', feedbackDescription: 'Primeste o confirmare cand faci o actiune.', audioFeedback: 'Feedback audio', audioFeedbackDescription: 'Reda un sunet cand este selectata o optiune.', testAudioFeedback: 'Testeaza feedbackul audio', audioFeedbackActive: 'Feedbackul audio este activ', preferencesSaved: 'Preferintele sunt salvate automat pe acest dispozitiv.',
  appConfiguration: 'CONFIGURAREA APLICATIEI', settingsDescription: 'Configureaza limba, aspectul, dispozitivele si panoul de comunicare.', resetAppSettings: 'Reseteaza setarile aplicatiei', language: 'Limba', languageDescription: 'Alege limba folosita de aplicatie.', appearance: 'Aspect', appearanceDescription: 'Alege tema vizuala a aplicatiei.', darkMode: 'Mod intunecat', showTargetIndicator: 'Afiseaza indicatorul tintei', debugOverlay: 'Suprapunere de depanare', debugOverlayDescription: 'Afiseaza privirea si diagnosticele calibrarii in timpul dezvoltarii.', camera: 'Camera', cameraDescription: 'Gestioneaza camera folosita pentru urmarire.', defaultCamera: 'Camera implicita', selectCamera: 'Selecteaza camera', checkCameraPermission: 'Verifica permisiunea camerei', cameraPermissionNotChecked: 'Permisiunea camerei nu a fost verificata.', cameraUnavailable: 'Camerele disponibile nu pot fi verificate.', cameraAvailable: 'Camera este disponibila.', noCameraDetected: 'Nu a fost detectata nicio camera.', cameraPermissionGranted: 'Permisiunea camerei a fost acordata.', cameraPermissionDenied: 'Permisiunea camerei a fost respinsa.', cameraNotSupported: 'Accesul la camera nu este acceptat in acest browser.', communicationBoard: 'Panou de comunicare', communicationBoardDescription: 'Alege actiunile afisate pe panou.', settingsSaved: 'Setarile sunt salvate automat pe acest dispozitiv.',
  eyeTrackingActive: 'Urmarirea privirii este activa', eyeTrackingReady: 'Urmarirea privirii este pregatita', cameraActive: 'Camera este activa', cameraOff: 'Camera este oprita', account: 'Cont', faceDetected: 'Fata detectata', noFaceDetected: 'Nicio fata detectata', eyeTrackingOff: 'Urmarirea privirii este oprita', calibrationReady: 'Calibrarea este pregatita', calibrationRequired: 'Este necesara calibrarea', faceRecognition: 'Recunoastere faciala', state: 'Stare', risk: 'Risc', expression: 'Expresie', indicators: 'Indicatori', none: 'Niciunul', cameraCalibration: 'Calibrarea camerei', closeCameraPopup: 'Inchide fereastra camerei', close: 'Inchide', faceRecognitionLive: 'Recunoasterea faciala este activa.', retry: 'Reincearca', cancel: 'Anuleaza', stopEyeTracking: 'Opreste urmarirea privirii', startEyeTracking: 'Porneste urmarirea privirii', eyeTrackingGuideTitle: 'Inainte de urmarirea privirii', eyeTrackingGuideDescription: 'Urmeaza aceste reguli simple in timpul calibrarii pentru o urmarire stabila.', eyeTrackingGuideCentered: 'Tine fata centrata in imaginea camerei.', eyeTrackingGuideEyesVisible: 'Tine ambii ochi deschisi si vizibili.', eyeTrackingGuideFollowTarget: 'Urmareste punctul colorat doar cu privirea.', eyeTrackingGuideHoldStill: 'Tine privirea fixa pana cand fiecare punct se finalizeaza.', beginCalibration: 'Incepe calibrarea', stopFaceRecognition: 'Opreste recunoasterea faciala', testFaceRecognition: 'Testeaza monitorizarea live', calibrating: 'Se calibreaza', recalibrateGaze: 'Recalibreaza privirea', calibrateGaze: 'Calibreaza privirea', footerNote: 'Prototip de comunicare asistiva. Atingerea ramane disponibila in orice moment.', messageFromNurse: 'Mesaj de la asistenta', chooseReply: 'Alege un raspuns pentru asistenta.', needHelp: 'Am nevoie de ajutor', understood: 'Am inteles', later: 'Mai tarziu',
  yes: 'Da', no: 'Nu', bathroom: 'Baie', food: 'Mancare', water: 'Apa', medication: 'Medicamente', pain: 'Durere', sleep: 'Somn', talk: 'Vorbeste cu cineva',
};

export function readStoredLanguage(): Language {
  try {
    const saved = JSON.parse(localStorage.getItem('voice-to-voiceless-settings') ?? '{}') as { language?: Language };
    return saved.language === 'Romanian' ? 'Romanian' : 'English';
  } catch {
    return 'English';
  }
}

export function useLanguage(): { language: Language; t: (key: TranslationKey) => string } {
  const [language, setLanguage] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    const updateLanguage = () => setLanguage(readStoredLanguage());
    window.addEventListener('voice-to-voiceless-settings-changed', updateLanguage);
    return () => window.removeEventListener('voice-to-voiceless-settings-changed', updateLanguage);
  }, []);

  return { language, t: (key: TranslationKey) => (language === 'Romanian' ? romanian : english)[key] };
}

export type { TranslationKey };
