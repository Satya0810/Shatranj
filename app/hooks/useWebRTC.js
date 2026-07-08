import { useRef, useState, useCallback, useEffect } from 'react';

export function useWebRTC(socketRef, gameId) {
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [webrtcError, setWebrtcError] = useState(null);

  // ICE candidates can arrive before the remote description is set
  const iceQueueRef = useRef([]);
  const isRemoteSetRef = useRef(false);

  // Cleanup function
  const cleanupWebRTC = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.warn);
      audioContextRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setConnectionState('closed');
    setWebrtcError(null);
    iceQueueRef.current = [];
    isRemoteSetRef.current = false;
  }, []);

  const initializeWebRTC = useCallback(async (isInitiator, sendVideo = true, receiveVideo = true) => {
    try {
      setWebrtcError(null);
      // Initialize PeerConnection
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnectionRef.current = pc;

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
      };

      pc.ontrack = (event) => {
        setRemoteStream(prev => {
          let stream = event.streams[0];
          if (!stream) {
            stream = prev ? prev : new MediaStream();
            stream.addTrack(event.track);
          }
          // Clone the stream to force React state update if we mutate it
          return new MediaStream(stream.getTracks());
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current && gameId) {
          socketRef.current.emit('webrtc-ice-candidate', { gameId, candidate: event.candidate });
        }
      };

      // Ensure device exists before calling getUserMedia (prevents NotFoundError crash loop)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasCamera = devices.some(d => d.kind === 'videoinput');
      const hasMic = devices.some(d => d.kind === 'audioinput');

      let stream;
      if (!hasMic && !hasCamera && (sendVideo || receiveVideo)) {
        throw new Error("No camera or microphone found on this device.");
      }

      // Delay camera grab for receiver to prevent browser crash during local testing race conditions
      if (!isInitiator) {
        await new Promise(r => setTimeout(r, 1000));
      }

      const actualSendVideo = sendVideo && hasCamera;
      
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: actualSendVideo, 
        audio: hasMic ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        } : false
      });

      // Amplify audio
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioCtx;
        
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(e => console.warn('Could not resume AudioContext', e));
        }
        
        const source = audioCtx.createMediaStreamSource(stream);
        const highpass = audioCtx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 85; 
        
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -40;
        compressor.knee.value = 20;
        compressor.ratio.value = 10;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.1;
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 2.0; 
        
        const destination = audioCtx.createMediaStreamDestination();
        
        source.connect(highpass);
        highpass.connect(compressor);
        compressor.connect(gainNode);
        gainNode.connect(destination);

        const amplifiedAudioTrack = destination.stream.getAudioTracks()[0];
        
        const tracksToSend = [];
        if (amplifiedAudioTrack) tracksToSend.push(amplifiedAudioTrack);
        
        if (actualSendVideo) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) tracksToSend.push(videoTrack);
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        const streamToSend = new MediaStream(tracksToSend);
        tracksToSend.forEach(track => pc.addTrack(track, streamToSend));
      } catch (audioErr) {
        console.warn("Audio amplification fallback:", audioErr);
        localStreamRef.current = stream;
        setLocalStream(stream);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      }

      if (isInitiator) {
        if (!actualSendVideo && receiveVideo) {
          pc.addTransceiver('video', { direction: 'recvonly' });
        } else if (actualSendVideo && !receiveVideo) {
          pc.addTransceiver('video', { direction: 'sendonly' });
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit('webrtc-offer', { gameId, offer });
      }

    } catch (err) {
      console.warn("WebRTC Setup Error:", err);
      let errorMsg = "Could not initialize media. ";
      if (window.isSecureContext === false) {
        errorMsg = "Browser blocked camera/mic due to insecure HTTP connection. ";
      } else if (err.name === 'NotAllowedError') {
        errorMsg = "Camera/Microphone permission denied. Please allow it in browser settings. ";
      } else {
        errorMsg += err.message;
      }
      setWebrtcError(errorMsg);

      // Fallback receiver logic
      localStreamRef.current = new MediaStream();
      setLocalStream(localStreamRef.current);

      if (isInitiator && peerConnectionRef.current) {
        try {
          peerConnectionRef.current.addTransceiver('audio', { direction: 'recvonly' });
          if (receiveVideo) {
            peerConnectionRef.current.addTransceiver('video', { direction: 'recvonly' });
          }
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          socketRef.current.emit('webrtc-offer', { gameId, offer });
        } catch (fallbackErr) {
          console.warn("Fallback offer failed:", fallbackErr);
        }
      }
    }
  }, [gameId, socketRef]);

  const handleOffer = useCallback(async (offer) => {
    // Wait for local stream so we can include video in the answer
    let attempts = 0;
    while (!localStreamRef.current && attempts < 50) {
      await new Promise(r => setTimeout(r, 200));
      attempts++;
    }
    
    const pc = peerConnectionRef.current;
    if (!pc) return;
    
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    isRemoteSetRef.current = true;
    
    iceQueueRef.current.forEach(async (candidate) => {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) {}
    });
    iceQueueRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit('webrtc-answer', { gameId, answer });
  }, [gameId, socketRef]);

  const handleAnswer = useCallback(async (answer) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    isRemoteSetRef.current = true;
    
    iceQueueRef.current.forEach(async (candidate) => {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) {}
    });
    iceQueueRef.current = [];
  }, []);

  const handleIceCandidate = useCallback(async (candidate) => {
    if (isRemoteSetRef.current && peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("Failed to add ICE candidate:", e);
      }
    } else {
      iceQueueRef.current.push(candidate);
    }
  }, []);

  return {
    localStream,
    remoteStream,
    connectionState,
    webrtcError,
    initializeWebRTC,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    cleanupWebRTC
  };
}
