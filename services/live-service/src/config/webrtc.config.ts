export const WebRTCConfig = {
  iceServers: [
    {
      urls: process.env.STUN_SERVER || 'stun:stun.l.google.com:19302',
    },
    {
      urls: process.env.TURN_SERVER,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_PASSWORD,
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all' as RTCIceTransportPolicy,
  bundlePolicy: 'max-bundle' as RTCBundlePolicy,
  rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
};

export const MediaConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
};

export const ScreenShareConstraints = {
  video: {
    frameRate: { ideal: 15 },
    width: { max: 1920 },
    height: { max: 1080 },
  },
};