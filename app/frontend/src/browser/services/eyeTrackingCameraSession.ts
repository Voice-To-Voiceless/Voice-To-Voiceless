export async function openEyeTrackingCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function closeEyeTrackingCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach(track => track.stop());
}