'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import ChessGame from './ChessGame';
import MoveList from './MoveList';
import GameOverModal from './GameOverModal';
import { useAuth } from './AuthContext';
import ProfileModal from './ProfileModal';
import { useRouter } from 'next/navigation';
import { getSocket, disconnectSocket } from '../lib/socket';

const TIME_CONTROLS = [
  { label: '1 min', minutes: 1, increment: 0, icon: '⚡' },
  { label: '3 min', minutes: 3, increment: 0, icon: '⚡' },
  { label: '3+2', minutes: 3, increment: 2, icon: '⚡' },
  { label: '5 min', minutes: 5, increment: 0, icon: '🔥' },
  { label: '5+3', minutes: 5, increment: 3, icon: '🔥' },
  { label: '10 min', minutes: 10, increment: 0, icon: '⏱️' },
  { label: '10+5', minutes: 10, increment: 5, icon: '⏱️' },
  { label: '15+10', minutes: 15, increment: 10, icon: '🐢' },
  { label: '30 min', minutes: 30, increment: 0, icon: '🐢' },
];

export default function PlayOnline() {
  const router = useRouter();
  const { user, token, openAuthModal } = useAuth();
  const [phase, setPhase] = useState('setup'); // 'setup' | 'searching' | 'playing' | 'gameover'
  const [game, setGame] = useState(new Chess());
  const [history, setHistory] = useState([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [gameResult, setGameResult] = useState(null);
  const [highlightSquares, setHighlightSquares] = useState({});
  const [boardWidth, setBoardWidth] = useState(560);
  const [orientation, setOrientation] = useState('white');
  const [opponent, setOpponent] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [selectedTC, setSelectedTC] = useState(5); // default 10 min
  const [whiteTime, setWhiteTime] = useState(600000);
  const [blackTime, setBlackTime] = useState(600000);
  const [drawOffered, setDrawOffered] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const socketRef = useRef(null);
  const searchIntervalRef = useRef(null);

  const [showProfileUsername, setShowProfileUsername] = useState(null);
  const clockIntervalRef = useRef(null);
  const lastMoveTimeRef = useRef(null);

  // WebRTC and Chat State
  const [activeTab, setActiveTab] = useState('moves'); // 'moves' | 'chat'
  const activeTabRef = useRef(activeTab);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === 'chat') {
      setHasUnreadMessages(false);
    }
  }, [activeTab]);
  const [chatInput, setChatInput] = useState('');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioContextRef = useRef(null); // Reference for audio amplification context
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [remoteStream, setRemoteStream] = useState(null);
  const [showVideoSection, setShowVideoSection] = useState(false);
  const [callMode, setCallMode] = useState('voice');
  const [callStatus, setCallStatus] = useState('idle'); // 'idle' | 'calling' | 'connected'
  const [incomingCall, setIncomingCall] = useState(null); // { mode }

  // Responsive board sizing
  useEffect(() => {
    const updateSize = () => {
      // Increase padding and vertical offset on mobile to shrink the board
      const isMobile = window.innerWidth <= 1024;
      const padding = isMobile ? 80 : 120; // 80px means 40px space on each side
      const verticalOffset = isMobile ? 220 : 280; // Leave more room above/below
      const maxHeight = window.innerHeight - verticalOffset;
      const maxWidth = isMobile
        ? Math.min(window.innerWidth - padding, 320) // Cap mobile board at 320px
        : Math.min(window.innerWidth * 0.55, 640);
      setBoardWidth(Math.min(maxWidth, maxHeight));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      disconnectSocket();
    };
  }, []);

  // Clock tick
  useEffect(() => {
    if (phase !== 'playing') {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      return;
    }

    clockIntervalRef.current = setInterval(() => {
      if (!lastMoveTimeRef.current) return;
      const elapsed = Date.now() - lastMoveTimeRef.current;
      const isMyTurn = (game.turn() === 'w' && orientation === 'white') || (game.turn() === 'b' && orientation === 'black');
      
      // Only tick the active player's clock locally for display purposes
      if (game.turn() === 'w') {
        setWhiteTime(prev => {
          const newTime = Math.max(0, prev - 100);
          return newTime;
        });
      } else {
        setBlackTime(prev => {
          const newTime = Math.max(0, prev - 100);
          return newTime;
        });
      }
    }, 100);

    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, [phase, game, orientation]);

  const formatTime = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const startSearching = useCallback(() => {
    if (!user) {
      openAuthModal();
      return;
    }

    const socket = getSocket();
    socketRef.current = socket;
    setPhase('searching');
    setSearchTime(0);

    searchIntervalRef.current = setInterval(() => {
      setSearchTime(prev => prev + 1);
    }, 1000);

    const tc = TIME_CONTROLS[selectedTC];

    socket.emit('join-lobby', {
      userId: user.id,
      username: user.username,
      rating: user.rating,
      timeControl: { minutes: tc.minutes, increment: tc.increment },
    });

    // Listen for game start
    socket.on('game-start', (data) => {
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
      
      setGameId(data.gameId);
      setOrientation(data.color);
      setOpponent(data.opponent);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      setGame(new Chess());
      setHistory([]);
      setCurrentMoveIndex(-1);
      setPhase('playing');
      lastMoveTimeRef.current = Date.now();
    });

    // Listen for moves
    socket.on('move-made', (data) => {
      setGame(prev => {
        const newGame = new Chess(data.fen);
        return newGame;
      });
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      lastMoveTimeRef.current = Date.now();

      if (data.history) {
        setHistory(data.history);
      }
      setCurrentMoveIndex(prev => prev + 1);
    });

    // Listen for game over
    socket.on('game-over', (data) => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);

      let result;
      if (data.winner === null) {
        result = { result: 'draw', winner: null };
      } else {
        result = {
          result: data.reason,
          winner: data.winner,
        };
      }
      setGameResult(result);
      setPhase('gameover');
    });

    // Listen for draw offers
    socket.on('draw-offered', () => {
      setDrawOffered(true);
    });

    socket.on('draw-declined', () => {
      // Could show a notification
    });

  }, [user, openAuthModal, selectedTC]);

  const cancelSearch = useCallback(() => {
    if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    const socket = socketRef.current;
    if (socket) {
      socket.emit('leave-lobby', {});
    }
    setPhase('setup');
    setSearchTime(0);
  }, []);

  const onMove = useCallback((move) => {
    if (phase !== 'playing') return;

    // Verify it's our turn
    const isOurTurn = (game.turn() === 'w' && orientation === 'white') || (game.turn() === 'b' && orientation === 'black');
    if (!isOurTurn) return;

    const socket = socketRef.current;
    if (socket && gameId) {
      socket.emit('move', {
        gameId,
        move: { from: move.from, to: move.to, promotion: move.promotion },
      });
    }

    setHighlightSquares({
      [move.from]: { background: 'rgba(129, 182, 74, 0.4)' },
      [move.to]: { background: 'rgba(129, 182, 74, 0.4)' },
    });
  }, [phase, game, orientation, gameId]);

  const handleResign = useCallback(() => {
    if (!gameId || !socketRef.current) return;
    if (confirm('Are you sure you want to resign?')) {
      socketRef.current.emit('resign', { gameId });
    }
  }, [gameId]);

  const handleOfferDraw = useCallback(() => {
    if (!gameId || !socketRef.current) return;
    socketRef.current.emit('offer-draw', { gameId });
  }, [gameId]);

  const handleAcceptDraw = useCallback(() => {
    if (!gameId || !socketRef.current) return;
    socketRef.current.emit('accept-draw', { gameId });
    setDrawOffered(false);
  }, [gameId]);

  // WebRTC Setup
  const initializeWebRTC = useCallback(async (isInitiator, withVideo = true) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current && gameId) {
          socketRef.current.emit('webrtc-ice-candidate', { gameId, candidate: event.candidate });
        }
      };

      // Delay camera grab for black player to prevent browser crash during local testing
      if (!isInitiator) {
        await new Promise(r => setTimeout(r, 1500));
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: withVideo, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        } 
      });

      // Amplify the audio using Web Audio API before sending over WebRTC
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioCtx;
        
        const source = audioCtx.createMediaStreamSource(stream);
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 2.5; // Amplify by 250%
        
        const destination = audioCtx.createMediaStreamDestination();
        source.connect(gainNode);
        gainNode.connect(destination);

        const amplifiedAudioTrack = destination.stream.getAudioTracks()[0];
        
        const tracksToSend = [amplifiedAudioTrack];
        if (withVideo) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) tracksToSend.push(videoTrack);
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        tracksToSend.forEach(track => pc.addTrack(track, stream));
      } catch (audioErr) {
        console.warn("Could not amplify audio, falling back to standard:", audioErr);
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      }

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit('webrtc-offer', { gameId, offer });
      }
    } catch (err) {
      console.warn("Could not access camera/mic:", err);
    }
  }, [gameId]);

  const handleStartCall = (mode) => {
    if (callStatus !== 'idle') return;
    setCallStatus('calling');
    socketRef.current.emit('call-request', { gameId, mode });
  };

  const handleHangUp = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setCallStatus('idle');
    setShowVideoSection(false);
    if (socketRef.current && gameId) {
      socketRef.current.emit('call-ended', { gameId });
    }
  }, [gameId]);

  useEffect(() => {
    if (phase === 'playing' && gameId && !peerConnectionRef.current) {
      // Auto-start disabled, user must click Voice or Video
    }
  }, [phase, gameId, orientation, initializeWebRTC]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !gameId) return;

    let iceQueue = [];
    let isRemoteSet = false;

    const handleChat = (data) => {
      setChatMessages(prev => [...prev, data]);
      if (activeTabRef.current !== 'chat') {
        setHasUnreadMessages(true);
      }
    };
    const handleOffer = async (data) => {
      // Wait for local stream so we can include video in the answer
      while (!localStreamRef.current) {
        await new Promise(r => setTimeout(r, 200));
      }
      const pc = peerConnectionRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      isRemoteSet = true;
      
      iceQueue.forEach(async (candidate) => {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) {}
      });
      iceQueue = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { gameId, answer });
    };
    const handleAnswer = async (data) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      isRemoteSet = true;
      
      iceQueue.forEach(async (candidate) => {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) {}
      });
      iceQueue = [];
    };
    const handleIce = async (data) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      if (!isRemoteSet) {
        iceQueue.push(data.candidate);
      } else {
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch(e) {}
      }
    };

    const handleCallRequest = (data) => {
      if (callStatus === 'idle') {
        setIncomingCall({ mode: data.mode });
      }
    };

    const handleCallAccepted = () => {
      setCallStatus('connected');
      if (callMode === 'share' || callMode === 'view') setShowVideoSection(true);
      initializeWebRTC(true, callMode !== 'voice'); // Caller is initiator
    };

    const handleCallDeclined = () => {
      setCallStatus('idle');
      alert("Opponent declined the call.");
    };

    const handleCallEnded = () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setCallStatus('idle');
      setShowVideoSection(false);
      alert("Opponent ended the call.");
    };

    socket.on('chat-message', handleChat);
    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIce);
    socket.on('call-request', handleCallRequest);
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-declined', handleCallDeclined);
    socket.on('call-ended', handleCallEnded);

    return () => {
      socket.off('chat-message', handleChat);
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIce);
      socket.off('call-request', handleCallRequest);
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-declined', handleCallDeclined);
      socket.off('call-ended', handleCallEnded);
    };
  }, [gameId, callStatus, callMode, initializeWebRTC]);

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !gameId || !socketRef.current) return;
    const msg = chatInput.trim();
    socketRef.current.emit('chat-message', { gameId, message: msg, sender: user?.username || 'Guest' });
    setChatMessages(prev => [...prev, { message: msg, sender: 'You' }]);
    setChatInput('');
  };

  const handleDeclineDraw = useCallback(() => {
    if (!gameId || !socketRef.current) return;
    socketRef.current.emit('decline-draw', { gameId });
    setDrawOffered(false);
  }, [gameId]);

  const playAgain = useCallback(() => {
    setPhase('setup');
    setGame(new Chess());
    setHistory([]);
    setCurrentMoveIndex(-1);
    setGameResult(null);
    setOpponent(null);
    setGameId(null);
    setDrawOffered(false);
    disconnectSocket();
    socketRef.current = null;
  }, []);

  // SETUP PHASE - Time control selection
  if (phase === 'setup') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 60px)',
        padding: 'var(--space-xl)',
      }}>
        <div style={{ maxWidth: '500px', width: '100%' }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{
              padding: 'var(--space-xl)',
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(129, 182, 74, 0.15), rgba(96, 165, 250, 0.15))',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{ fontSize: '48px', marginBottom: 'var(--space-sm)' }}>🌐</div>
              <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Play Online</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Find an opponent and play in real-time
              </p>
              {user && (
                <div style={{
                  marginTop: 'var(--space-md)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-sm)',
                  padding: '6px 16px',
                  background: 'rgba(129, 182, 74, 0.15)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '13px',
                  fontWeight: 600,
                }}>
                  <span>👤 {user.username}</span>
                  <span className="badge badge-gold">{user.rating}</span>
                </div>
              )}
            </div>

            <div style={{ padding: 'var(--space-xl)' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-md)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Select Time Control
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--space-sm)',
                marginBottom: 'var(--space-xl)',
              }}>
                {TIME_CONTROLS.map((tc, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedTC(idx)}
                    style={{
                      padding: 'var(--space-md)',
                      background: selectedTC === idx
                        ? 'linear-gradient(135deg, var(--accent-green), #6ab04c)'
                        : 'var(--bg-surface)',
                      border: selectedTC === idx
                        ? '2px solid var(--accent-green)'
                        : '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: selectedTC === idx ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    <div style={{ fontSize: '18px', marginBottom: '2px' }}>{tc.icon}</div>
                    {tc.label}
                  </button>
                ))}
              </div>

              <button
                className="btn btn-primary"
                onClick={startSearching}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, var(--accent-green), #6ab04c)',
                }}
              >
                {user ? '🎮 Find Opponent' : '🔑 Sign In to Play'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // SEARCHING PHASE
  if (phase === 'searching') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 60px)',
        padding: 'var(--space-xl)',
      }}>
        <div className="card" style={{
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
          padding: 'var(--space-2xl)',
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            border: '4px solid var(--border-color)',
            borderTop: '4px solid var(--accent-green)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto var(--space-xl)',
          }} />
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
            Finding Opponent...
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: 'var(--space-md)' }}>
            {TIME_CONTROLS[selectedTC].label} • {user?.rating || 1200} rating
          </p>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '32px',
            fontWeight: 700,
            color: 'var(--accent-green)',
            marginBottom: 'var(--space-xl)',
          }}>
            {Math.floor(searchTime / 60)}:{(searchTime % 60).toString().padStart(2, '0')}
          </div>
          <button
            className="btn btn-secondary"
            onClick={cancelSearch}
            style={{ width: '100%' }}
          >
            ✕ Cancel
          </button>
        </div>
      </div>
    );
  }

  // PLAYING PHASE
  return (
    <div className="play-layout" id="play-online-layout">
      {/* Video Section */}
      <div className="video-section" style={{ display: showVideoSection ? 'flex' : 'none', flexDirection: 'column', gap: 'var(--space-md)', width: '240px', flexShrink: 0 }}>
        <div className="card" style={{ padding: 'var(--space-sm)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Opponent Video</div>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            style={{ width: '100%', aspectRatio: '4/3', borderRadius: 'var(--radius-md)', objectFit: 'cover', background: '#000', display: remoteStream ? 'block' : 'none' }} 
          />
          {!remoteStream && (
            <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Waiting for opponent...</div>
          )}
        </div>
        <div className="card" style={{ padding: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Your Video</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={toggleAudio} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: isAudioEnabled ? 1 : 0.5, fontSize: '14px' }} title="Toggle Audio">{isAudioEnabled ? '🎙️' : '🔇'}</button>
              <button onClick={toggleVideo} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: isVideoEnabled ? 1 : 0.5, fontSize: '14px' }} title="Toggle Video">{isVideoEnabled ? '📹' : '🚫'}</button>
            </div>
          </div>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline 
            style={{ width: '100%', aspectRatio: '4/3', borderRadius: 'var(--radius-md)', objectFit: 'cover', background: '#000', display: localStreamRef.current ? 'block' : 'none' }} 
          />
          {!localStreamRef.current && (
            <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Camera off</div>
          )}
        </div>
      </div>

      <div className="board-section">
        {/* Opponent info bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-sm)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: opponent?.username ? 'pointer' : 'default' }}
              onClick={() => opponent?.username && setShowProfileUsername(opponent.username)}
            >
              <span style={{ fontSize: '20px' }}>👤</span>
              <span style={{ fontWeight: 600 }}>{opponent?.username || 'Opponent'}</span>
              <span className="badge badge-gold" style={{ fontSize: '11px' }}>{opponent?.rating || '?'}</span>
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '20px',
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 'var(--radius-md)',
            background: (orientation === 'white' ? blackTime : whiteTime) <= 30000
              ? 'rgba(224, 90, 90, 0.2)' : 'var(--bg-surface)',
            color: (orientation === 'white' ? blackTime : whiteTime) <= 30000
              ? 'var(--accent-red)' : 'var(--text-primary)',
          }}>
            {formatTime(orientation === 'white' ? blackTime : whiteTime)}
          </div>
        </div>

        <ChessGame
          game={game}
          onMove={onMove}
          boardWidth={boardWidth}
          orientation={orientation}
          allowMoves={phase === 'playing'}
          highlightSquares={highlightSquares}
        />

        {/* Your info bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          marginTop: 'var(--space-sm)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: user?.username ? 'pointer' : 'default' }}
              onClick={() => user?.username && setShowProfileUsername(user.username)}
            >
              <span style={{ fontSize: '20px' }}>👤</span>
              <span style={{ fontWeight: 600 }}>{user?.username || 'You'}</span>
              <span className="badge badge-green" style={{ fontSize: '11px' }}>{user?.rating || '?'}</span>
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '20px',
            fontWeight: 700,
            padding: '4px 12px',
            borderRadius: 'var(--radius-md)',
            background: (orientation === 'white' ? whiteTime : blackTime) <= 30000
              ? 'rgba(224, 90, 90, 0.2)' : 'var(--bg-surface)',
            color: (orientation === 'white' ? whiteTime : blackTime) <= 30000
              ? 'var(--accent-red)' : 'var(--text-primary)',
          }}>
            {formatTime(orientation === 'white' ? whiteTime : blackTime)}
          </div>
        </div>
      </div>

      <div className="game-panel">
        {/* Tabs for Moves and Chat */}
        <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ padding: '0', display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
            <button 
              onClick={() => setActiveTab('moves')}
              style={{ flex: 1, padding: '12px', background: activeTab === 'moves' ? 'var(--bg-surface)' : 'transparent', border: 'none', color: activeTab === 'moves' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}
            >Moves</button>
            <button 
              onClick={() => setActiveTab('chat')}
              style={{ flex: 1, padding: '12px', background: activeTab === 'chat' ? 'var(--bg-surface)' : 'transparent', border: 'none', color: activeTab === 'chat' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              Chat
              {hasUnreadMessages && (
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)' }} title="New message" />
              )}
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'moves' ? (
              <MoveList
                history={history}
                currentMoveIndex={currentMoveIndex}
                onSelectMove={() => {}}
              />
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {chatMessages.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '20px' }}>No messages yet</div>}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} style={{ 
                      alignSelf: msg.sender === 'You' ? 'flex-end' : 'flex-start',
                      background: msg.sender === 'You' ? 'var(--accent-green)' : 'var(--bg-surface-hover)',
                      color: msg.sender === 'You' ? 'white' : 'var(--text-primary)',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      maxWidth: '80%',
                      wordBreak: 'break-word'
                    }}>
                      <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '2px' }}>{msg.sender}</div>
                      <div style={{ fontSize: '13px' }}>{msg.message}</div>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendChatMessage} style={{ display: 'flex', padding: '12px', borderTop: '1px solid var(--border-color)', gap: '8px' }}>
                  <input 
                    type="text" 
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)} 
                    placeholder="Type a message..." 
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  />
                  <button type="submit" style={{ background: 'var(--accent-green)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button>
                </form>
              </div>
            )}
          </div>
        </div>

          <div className="card-body" style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            {callStatus === 'connected' ? (
              <button
                className="btn"
                onClick={handleHangUp}
                style={{ 
                  flex: '1 1 100%', 
                  padding: '8px 12px', 
                  fontSize: '13px',
                  background: 'rgba(224, 90, 90, 0.15)',
                  color: 'var(--accent-red)',
                  border: '1px solid rgba(224, 90, 90, 0.3)'
                }}
                title="End Call to change options"
              >
                🔴 Hang Up
              </button>
            ) : (
              <div style={{ flex: '1 1 100%', display: 'flex', gap: '4px' }}>
                <select 
                  className="btn btn-secondary" 
                  style={{ flex: 1, padding: '8px 4px', fontSize: '13px', borderRight: 'none', borderRadius: '4px 0 0 4px', minWidth: 0 }}
                  value={callMode}
                  onChange={e => setCallMode(e.target.value)}
                  disabled={callStatus !== 'idle'}
                  title="Select Call Mode"
                >
                  <option value="voice">🎙️ Voice Only</option>
                  <option value="view">👁️ View Video</option>
                  <option value="share">📹 Share Video</option>
                </select>
                <button
                  className={`btn ${callStatus === 'idle' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    if (callStatus === 'idle') handleStartCall(callMode);
                  }}
                  disabled={callStatus !== 'idle'}
                  style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '0 4px 4px 0' }}
                  title="Join Conversation"
                >
                  {callStatus === 'idle' ? 'Join' : 'Ringing...'}
                </button>
              </div>
            )}
            <button
              className="btn btn-secondary"
              onClick={handleOfferDraw}
              style={{ flex: '1 1 calc(50% - 4px)' }}
              title="Offer Draw"
            >
              🤝 Draw
            </button>
            <button
              className="btn"
              onClick={handleResign}
              style={{
                flex: '1 1 calc(50% - 4px)',
                background: 'rgba(224, 90, 90, 0.15)',
                color: 'var(--accent-red)',
                border: '1px solid rgba(224, 90, 90, 0.3)',
              }}
              title="Resign"
            >
              🏳️ Resign
            </button>
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {gameResult && (
        <GameOverModal
          result={gameResult}
          onNewGame={playAgain}
          onAnalyze={() => {
            const replayGame = new Chess();
            for (const move of history) {
              replayGame.move(move.san || move);
            }
            const pgn = replayGame.pgn();
            router.push(`/analyze?pgn=${encodeURIComponent(pgn)}&autoAnalyze=true`);
          }}
          onClose={() => setGameResult(null)}
        />
      )}

      {showProfileUsername && (
        <ProfileModal username={showProfileUsername} onClose={() => setShowProfileUsername(null)} />
      )}
    </div>
    </>
  );
}
