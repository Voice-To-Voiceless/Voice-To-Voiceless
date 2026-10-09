declare module 'webgazer' {
  type WebGazerPoint = { x: number; y: number };
  type WebGazerPrediction = WebGazerPoint | null;

  type WebGazerRuntime = {
    begin(onFail?: () => void): Promise<unknown>;
    clearData(): Promise<void>;
    clearGazeListener(): WebGazerRuntime;
    end(): WebGazerRuntime;
    getCurrentPrediction(): Promise<WebGazerPrediction>;
      getTracker(): { detector?: { dispose?: () => Promise<void> | void } };
    getRegression(): Array<{ getData(): unknown[] }>;
    pause(): WebGazerRuntime;
    params: { faceMeshSolutionPath: string };
    recordScreenPosition(x: number, y: number, eventType?: 'click' | 'move'): WebGazerRuntime;
    removeMouseEventListeners(): WebGazerRuntime;
    saveDataAcrossSessions(enabled: boolean): WebGazerRuntime;
    setTracker(name: 'TFFacemesh'): WebGazerRuntime;
    setGazeListener(listener: (data: WebGazerPrediction, elapsedTime: number) => void): WebGazerRuntime;
    setRegression(name: 'ridge' | 'weightedRidge' | 'threadedRidge'): WebGazerRuntime;
    showPredictionPoints(enabled: boolean): WebGazerRuntime;
    showVideoPreview(enabled: boolean): WebGazerRuntime;
    stopVideo(): WebGazerRuntime;
    applyKalmanFilter(enabled: boolean): WebGazerRuntime;
  };

  const webgazer: WebGazerRuntime;
  export default webgazer;
}

declare module 'webgazer/dist/webgazer.js?url' {
  const url: string;
  export default url;
}
