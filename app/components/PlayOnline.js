'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import ChessGame from './ChessGame';
import MoveList from './MoveList';
import GameOverModal from './GameOverModal';
import { useAuth } from './AuthContext';
import ProfileModal from './ProfileModal';
import { useRouter } from 'next/navigation';
import { getSocket, disconnectSocket } from '../lib/socket';
import dynamic from 'next/dynamic';

const MapLobby = dynamic(() => import('./MapLobby'), { ssr: false });

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
  const [incomingDrawOffer, setIncomingDrawOffer] = useState(false);
  const [hasSentDrawOffer, setHasSentDrawOffer] = useState(false);
  const [drawOffersCount, setDrawOffersCount] = useState(0);
  const [searchTime, setSearchTime] = useState(0);
  const socketRef = useRef(null);
  const searchIntervalRef = useRef(null);

  // Nearby Play State
  const [nearbyPlayers, setNearbyPlayers] = useState([]);
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [sentChallenge, setSentChallenge] = useState(null);

  // Nearby challenge note & block
  const [challengeNote, setChallengeNote] = useState('');
  const [showNoteModal, setShowNoteModal] = useState(null); // { socketId, username }
  const [blockedNearbyUsers, setBlockedNearbyUsers] = useState([]);

  // Map Lobby State
  const [userLocation, setUserLocation] = useState(null);
  const [mapPlayers, setMapPlayers] = useState([]);

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
  const remoteAudioRef = useRef(null);
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
  const callTimeoutRef = useRef(null);

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

  // Cleanup on unmount, and also handle global game-starts
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Handle game-starts from globally accepted challenges
    const handleGlobalGameStart = (data) => {
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
      setIncomingChallenge(null);
      setSentChallenge(null);
      setDrawOffersCount(0);
      setHasSentDrawOffer(false);
      setIncomingDrawOffer(false);
      
      // We must register the rest of the listeners now that a game started
      registerGameListeners(socket);
    };

    socket.on('game-start', handleGlobalGameStart);

    return () => {
      socket.off('game-start', handleGlobalGameStart);
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

  const captured = useMemo(() => {
    const pieces = game.fen().split(' ')[0];
    const initialCounts = { p: 8, n: 2, b: 2, r: 2, q: 1, P: 8, N: 2, B: 2, R: 2, Q: 1 };
    const currentCounts = { p: 0, n: 0, b: 0, r: 0, q: 0, P: 0, N: 0, B: 0, R: 0, Q: 0 };
    for (const char of pieces) {
      if (currentCounts[char] !== undefined) currentCounts[char]++;
    }
    
    const whiteCaptured = {
      p: Math.max(0, initialCounts.p - currentCounts.p),
      n: Math.max(0, initialCounts.n - currentCounts.n),
      b: Math.max(0, initialCounts.b - currentCounts.b),
      r: Math.max(0, initialCounts.r - currentCounts.r),
      q: Math.max(0, initialCounts.q - currentCounts.q),
    };
    
    const blackCaptured = {
      P: Math.max(0, initialCounts.P - currentCounts.P),
      N: Math.max(0, initialCounts.N - currentCounts.N),
      B: Math.max(0, initialCounts.B - currentCounts.B),
      R: Math.max(0, initialCounts.R - currentCounts.R),
      Q: Math.max(0, initialCounts.Q - currentCounts.Q),
    };
    
    const values = { p: 1, n: 3, b: 3, r: 5, q: 9, P: 1, N: 3, B: 3, R: 5, Q: 9 };
    let whiteScore = 0;
    let blackScore = 0;
    Object.keys(whiteCaptured).forEach(k => { whiteScore += whiteCaptured[k] * values[k]; });
    Object.keys(blackCaptured).forEach(k => { blackScore += blackCaptured[k] * values[k]; });
    
    return {
      whiteCaptured,
      blackCaptured,
      whiteAdvantage: whiteScore - blackScore,
      blackAdvantage: blackScore - whiteScore,
    };
  }, [game]);

  const renderCapturedPieces = (capturedDict, advantage, capturedColor) => {
    const order = ['p', 'n', 'b', 'r', 'q'];
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', minHeight: '18px' }}>
        {order.map(pieceChar => {
          const dictKey = capturedColor === 'w' ? pieceChar.toUpperCase() : pieceChar.toLowerCase();
          const count = capturedDict[dictKey];
          if (!count || count <= 0) return null;
          
          return (
            <div key={pieceChar} style={{ display: 'flex' }}>
              {Array.from({ length: count }).map((_, i) => (
                <img 
                  key={i} 
                  src={`https://images.chesscomfiles.com/chess-themes/pieces/neo/150/${capturedColor}${pieceChar}.png`} 
                  alt={pieceChar}
                  style={{ width: '18px', height: '18px', marginLeft: i > 0 ? '-10px' : '2px' }}
                />
              ))}
            </div>
          );
        })}
        {advantage > 0 && (
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '6px' }}>
            +{advantage}
          </span>
        )}
      </div>
    );
  };

  const registerGameListeners = (socket) => {
    socket.off('game-start');
    socket.off('rejoin-game');
    socket.off('move-made');
    socket.off('game-over');
    socket.off('draw-offered');
    socket.off('draw-declined');

    socket.on('rejoin-game', (data) => {
      if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
      setGameId(data.gameId);
      setOrientation(data.color);
      setOpponent(data.opponent);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);
      
      const newGame = new Chess();
      for (const move of data.history) {
        newGame.move(move);
      }
      setGame(newGame);
      setHistory(data.history);
      setCurrentMoveIndex(data.history.length - 1);
      lastMoveTimeRef.current = Date.now();
      
      setPhase('playing');
      setIncomingChallenge(null);
      setSentChallenge(null);
      setDrawOffersCount(0);
      setHasSentDrawOffer(false);
      setIncomingDrawOffer(false);
    });

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
      setIncomingChallenge(null);
      setSentChallenge(null);
      setDrawOffersCount(0);
      setHasSentDrawOffer(false);
      setIncomingDrawOffer(false);
    });

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

    socket.on('game-over', (data) => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
      setWhiteTime(data.whiteTime);
      setBlackTime(data.blackTime);

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
      
      let result;
      if (data.winner === null) {
        result = { result: 'draw', winner: null };
      } else {
        result = { result: data.reason, winner: data.winner };
      }
      setGameResult(result);
      setPhase('gameover');
    });

    socket.on('draw-offered', () => setIncomingDrawOffer(true));
    socket.on('draw-declined', () => {
      setHasSentDrawOffer(false);
      alert('Opponent declined your draw offer.');
    });
  };

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    registerGameListeners(socket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    registerGameListeners(socket);
  }, [user, openAuthModal, selectedTC]);

  const startNearby = useCallback(() => {
    if (!user) {
      openAuthModal();
      return;
    }
    const socket = getSocket();
    socketRef.current = socket;
    setPhase('nearby');
    socket.emit('auth', { userId: user.id });

    const tc = TIME_CONTROLS[selectedTC];
    socket.emit('join-nearby', {
      userId: user.id,
      username: user.username,
      rating: user.rating,
      timeControl: { minutes: tc.minutes, increment: tc.increment },
    });

    socket.off('nearby-players');
    socket.off('incoming-challenge');
    socket.off('challenge-declined');

    socket.on('nearby-players', (players) => {
      setNearbyPlayers(players);
    });

    socket.on('incoming-challenge', (data) => {
      // Ignore challenges from blocked users
      if (blockedNearbyUsers.includes(data.challenger.userId)) return;
      setIncomingChallenge(data.challenger);
    });

    socket.on('challenge-declined', () => {
      setSentChallenge(null);
      alert('Challenge declined');
    });

    registerGameListeners(socket);
  }, [user, openAuthModal, selectedTC]);

  const cancelNearby = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit('leave-nearby', {});
    }
    setPhase('setup');
    setNearbyPlayers([]);
    setIncomingChallenge(null);
    setSentChallenge(null);
  }, []);

  const challengeNearbyPlayer = (targetSocketId, username) => {
    const socket = socketRef.current;
    if (socket) {
      const tc = TIME_CONTROLS[selectedTC];
      socket.emit('challenge-nearby', { targetSocketId, timeControl: { minutes: tc.minutes, increment: tc.increment }, note: challengeNote });
      setSentChallenge(username);
      setShowNoteModal(null);
      setChallengeNote('');
    }
  };

  const openChallengeModal = (socketId, username) => {
    setShowNoteModal({ socketId, username });
    setChallengeNote('');
  };

  const acceptNearbyChallenge = () => {
    const socket = socketRef.current;
    if (socket && incomingChallenge) {
      socket.emit('accept-nearby-challenge', { challengerSocketId: incomingChallenge.socketId });
    }
  };

  const declineNearbyChallenge = () => {
    const socket = socketRef.current;
    if (socket && incomingChallenge) {
      socket.emit('decline-nearby-challenge', { challengerSocketId: incomingChallenge.socketId });
      setIncomingChallenge(null);
    }
  };

  const blockNearbyUser = () => {
    if (incomingChallenge) {
      setBlockedNearbyUsers(prev => [...prev, incomingChallenge.userId]);
      const socket = socketRef.current;
      if (socket) {
        socket.emit('decline-nearby-challenge', { challengerSocketId: incomingChallenge.socketId });
      }
      setIncomingChallenge(null);
    }
  };

  const startMapLobby = useCallback(() => {
    if (!user) {
      openAuthModal();
      return;
    }
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });
        
        const socket = getSocket();
        socketRef.current = socket;
        setPhase('map');
        socket.emit('auth', { userId: user.id });

        const tc = TIME_CONTROLS[selectedTC];
        socket.emit('join-map-lobby', {
          userId: user.id,
          username: user.username,
          rating: user.rating,
          lat, lng,
          timeControl: { minutes: tc.minutes, increment: tc.increment },
        });

        socket.off('map-players');
        socket.off('incoming-map-challenge');
        socket.off('map-challenge-declined');

        socket.on('map-players', (players) => {
          setMapPlayers(players);
        });

        socket.on('incoming-map-challenge', (data) => {
          setIncomingChallenge(data.challenger);
        });

        socket.on('map-challenge-declined', () => {
          setSentChallenge(null);
          alert('Challenge declined');
        });

        registerGameListeners(socket);
      }, (err) => {
        alert("Please allow location access to find nearby players on the map.");
      });
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  }, [user, openAuthModal, selectedTC]);

  const cancelMapLobby = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit('leave-map-lobby', {});
    }
    setPhase('setup');
    setMapPlayers([]);
    setIncomingChallenge(null);
    setSentChallenge(null);
  }, []);

  const challengeMapPlayer = (targetSocketId, username) => {
    const socket = socketRef.current;
    if (socket) {
      const tc = TIME_CONTROLS[selectedTC];
      socket.emit('challenge-map-player', { targetSocketId, timeControl: { minutes: tc.minutes, increment: tc.increment } });
      setSentChallenge(username);
    }
  };

  const acceptMapChallenge = () => {
    const socket = socketRef.current;
    if (socket && incomingChallenge) {
      socket.emit('accept-map-challenge', { challengerSocketId: incomingChallenge.socketId });
    }
  };

  const declineMapChallenge = () => {
    const socket = socketRef.current;
    if (socket && incomingChallenge) {
      socket.emit('decline-map-challenge', { challengerSocketId: incomingChallenge.socketId });
      setIncomingChallenge(null);
    }
  };


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
    if (!gameId || !socketRef.current || drawOffersCount >= 5) return;
    socketRef.current.emit('offer-draw', { gameId });
    setHasSentDrawOffer(true);
    setDrawOffersCount(prev => prev + 1);
  }, [gameId, drawOffersCount]);

  const handleAcceptDraw = useCallback(() => {
    if (!gameId || !socketRef.current) return;
    socketRef.current.emit('accept-draw', { gameId });
    setIncomingDrawOffer(false);
  }, [gameId]);

  // WebRTC Setup
  const initializeWebRTC = useCallback(async (isInitiator, sendVideo = true, receiveVideo = true) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      peerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        let stream = event.streams[0];
        if (!stream) {
          if (!remoteVideoRef.current.srcObject) {
            remoteVideoRef.current.srcObject = new MediaStream();
          }
          stream = remoteVideoRef.current.srcObject;
          stream.addTrack(event.track);
        }
        
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(e => console.warn('Video autoplay blocked:', e));
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(e => console.warn('Audio autoplay blocked:', e));
        }
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
        video: sendVideo, 
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
        
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(e => console.warn('Could not resume AudioContext', e));
        }
        
        const source = audioCtx.createMediaStreamSource(stream);
        
        // 1. High-pass filter to remove low frequency rumble/noise
        const highpass = audioCtx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 85; 
        
        // 2. Dynamics Compressor to normalize voice levels
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -40; // DB threshold to start compressing
        compressor.knee.value = 20;
        compressor.ratio.value = 10;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.1;
        
        // 3. Gain Node for extra amplification
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 2.0; 
        
        const destination = audioCtx.createMediaStreamDestination();
        
        // Chain: source -> highpass -> compressor -> gain -> destination
        source.connect(highpass);
        highpass.connect(compressor);
        compressor.connect(gainNode);
        gainNode.connect(destination);

        const amplifiedAudioTrack = destination.stream.getAudioTracks()[0];
        
        const tracksToSend = [amplifiedAudioTrack];
        if (sendVideo) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) tracksToSend.push(videoTrack);
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const streamToSend = new MediaStream(tracksToSend);
        tracksToSend.forEach(track => pc.addTrack(track, streamToSend));
      } catch (audioErr) {
        console.warn("Could not amplify audio, falling back to standard:", audioErr);
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      }

      if (isInitiator) {
        if (!sendVideo && receiveVideo) {
          pc.addTransceiver('video', { direction: 'recvonly' });
        } else if (sendVideo && !receiveVideo) {
          pc.addTransceiver('video', { direction: 'sendonly' });
        }
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit('webrtc-offer', { gameId, offer });
      }
    } catch (err) {
      console.warn("Could not access camera/mic:", err);
      if (window.isSecureContext === false) {
        alert("Camera/Microphone access is blocked by your browser because the connection is not secure (HTTP). You can still receive the opponent's media.");
      } else {
        alert("Camera/Microphone permission was denied. Please allow access in your browser settings to share your media.");
      }
      
      // Fallback: create empty stream so the receiver loop breaks, allowing them to still receive video
      localStreamRef.current = new MediaStream();
      
      if (isInitiator && peerConnectionRef.current) {
        try {
          peerConnectionRef.current.addTransceiver('audio', { direction: 'recvonly' });
          if (receiveVideo) {
            peerConnectionRef.current.addTransceiver('video', { direction: 'recvonly' });
          }
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          socketRef.current.emit('webrtc-offer', { gameId, offer });
        } catch (e) {
          console.warn("Offer creation failed in fallback:", e);
        }
      }
    }
  }, [gameId]);

  const handleStartCall = (mode) => {
    if (callStatus !== 'idle') return;
    setCallStatus('calling');
    socketRef.current.emit('call-request', { gameId, mode });
    
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = setTimeout(() => {
      setCallStatus((prev) => {
        if (prev === 'calling') {
          socketRef.current?.emit('call-ended', { gameId });
          setTimeout(() => alert('No answer from opponent.'), 100);
          return 'idle';
        }
        return prev;
      });
    }, 30000);
  };

  const handleAcceptCall = useCallback(() => {
    if (!incomingCall || !socketRef.current) return;
    setCallStatus('connected');
    const mode = incomingCall.mode;
    setCallMode(mode);
    setShowVideoSection(mode === 'view' || mode === 'share');
    socketRef.current.emit('call-accepted', { gameId, mode });
    setIncomingCall(null);
    
    let sendVideo = false;
    let receiveVideo = false;
    if (mode === 'share') { sendVideo = true; receiveVideo = true; }
    else if (mode === 'view') { sendVideo = true; receiveVideo = false; }
    
    initializeWebRTC(false, sendVideo, receiveVideo);
  }, [incomingCall, gameId, initializeWebRTC]);

  const handleDeclineCall = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('call-ended', { gameId });
    setIncomingCall(null);
  }, [gameId]);

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
      // Wait for local stream so we can include video in the answer (timeout after 10s)
      let attempts = 0;
      while (!localStreamRef.current && attempts < 50) {
        await new Promise(r => setTimeout(r, 200));
        attempts++;
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

    const handleCallAccepted = (data) => {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      setCallStatus('connected');
      const mode = data && data.mode ? data.mode : callMode;
      setCallMode(mode);
      if (mode === 'share' || mode === 'view') setShowVideoSection(true);
      
      let sendVideo = false;
      let receiveVideo = false;
      if (mode === 'share') { sendVideo = true; receiveVideo = true; }
      else if (mode === 'view') { sendVideo = false; receiveVideo = true; }
      
      initializeWebRTC(true, sendVideo, receiveVideo);
    };

    const handleCallDeclined = () => {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      setCallStatus('idle');
      alert("Opponent declined the call.");
    };

    const handleCallEnded = () => {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
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
    setIncomingDrawOffer(false);
  }, [gameId]);

  const playAgain = useCallback(() => {
    setPhase('setup');
    setGame(new Chess());
    setHistory([]);
    setCurrentMoveIndex(-1);
    setGameResult(null);
    setOpponent(null);
    setGameId(null);
    setIncomingDrawOffer(false);
    setHasSentDrawOffer(false);
    setDrawOffersCount(0);
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
              
              <button
                className="btn btn-secondary"
                onClick={startNearby}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: 700,
                  marginTop: 'var(--space-sm)'
                }}
              >
                {user ? '📡 Play Nearby (WiFi)' : '🔑 Sign In to Play Nearby'}
              </button>

              <button
                className="btn btn-secondary"
                onClick={startMapLobby}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: 700,
                  marginTop: 'var(--space-sm)',
                  background: 'linear-gradient(135deg, #2b5876, #4e4376)',
                  color: 'white',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
              >
                {user ? '🌍 Find Players on Map' : '🔑 Sign In to Find Players on Map'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // NEARBY PHASE
  if (phase === 'nearby') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 60px)',
        padding: 'var(--space-xl)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Radar Animation Rings */}
        <div style={{
          position: 'absolute',
          width: '600px', height: '600px',
          border: '1px solid rgba(129, 182, 74, 0.2)',
          borderRadius: '50%',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite'
        }} />
        <div style={{
          position: 'absolute',
          width: '400px', height: '400px',
          border: '2px solid rgba(129, 182, 74, 0.3)',
          borderRadius: '50%',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
        }} />

        <div style={{ textAlign: 'center', zIndex: 10, maxWidth: '650px', width: '100%' }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'var(--accent-green)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            color: 'white',
            margin: '0 auto var(--space-lg)',
            boxShadow: '0 0 20px rgba(129, 182, 74, 0.4)'
          }}>
            📡
          </div>
          <h2 style={{ marginBottom: 'var(--space-sm)' }}>Nearby Players</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-xl)' }}>Players on your WiFi network • Send a request to play!</p>
          
          {/* Players List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)' }}>
            {nearbyPlayers.filter(p => !blockedNearbyUsers.includes(p.userId)).length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-color)' }}>
                <div style={{ fontSize: '40px', marginBottom: 'var(--space-sm)' }}>👀</div>
                No players found yet. Ask someone nearby to join!
              </div>
            ) : (
              nearbyPlayers.filter(p => !blockedNearbyUsers.includes(p.userId)).map(p => (
                <div key={p.socketId} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-md) var(--space-lg)',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                    <div style={{
                      width: '48px', height: '48px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent-green), var(--accent-blue))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '22px', color: 'white', fontWeight: 'bold'
                    }}>
                      {p.username.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: '16px' }}>{p.username}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rating: {p.rating}</div>
                    </div>
                  </div>
                  {sentChallenge === p.username ? (
                    <div style={{ fontSize: '13px', color: 'var(--accent-gold)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="spinner" style={{ width: '14px', height: '14px' }} /> Sent...
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => openChallengeModal(p.socketId, p.username)}
                      style={{ fontWeight: 700, padding: '8px 16px' }}
                    >
                      ⚔️ Challenge
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <button className="btn btn-secondary" onClick={cancelNearby} style={{ marginTop: 'var(--space-md)' }}>
            ✕ Leave Lobby
          </button>
        </div>

        {/* Send Challenge Modal with Note */}
        {showNoteModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
            backdropFilter: 'blur(4px)'
          }}>
            <div className="card" style={{ padding: 'var(--space-xl)', textAlign: 'center', maxWidth: '380px', width: '90%' }}>
              <div style={{ fontSize: '40px', marginBottom: 'var(--space-md)' }}>⚔️</div>
              <h3 style={{ marginBottom: 'var(--space-sm)' }}>Challenge {showNoteModal.username}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-lg)', fontSize: '14px' }}>Add an optional note to your challenge request.</p>
              <textarea
                value={challengeNote}
                onChange={(e) => setChallengeNote(e.target.value)}
                placeholder="e.g. GG last game! Rematch? 🔥"
                maxLength={100}
                style={{
                  width: '100%',
                  padding: 'var(--space-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  resize: 'none',
                  minHeight: '70px',
                  marginBottom: 'var(--space-lg)',
                  fontFamily: 'inherit'
                }}
              />
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => challengeNearbyPlayer(showNoteModal.socketId, showNoteModal.username)}
                  style={{ flex: 1, fontWeight: 700 }}
                >
                  🚀 Send Challenge
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setShowNoteModal(null); setChallengeNote(''); }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Incoming Challenge Modal */}
        {incomingChallenge && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
            backdropFilter: 'blur(4px)'
          }}>
            <div className="card" style={{ padding: 'var(--space-xl)', textAlign: 'center', maxWidth: '360px', width: '90%' }}>
              <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)' }}>⚔️</div>
              <h3 style={{ marginBottom: 'var(--space-xs)' }}>Challenge Received!</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '16px' }}>
                <strong>{incomingChallenge.username}</strong> ({incomingChallenge.rating}) wants to play a <strong>{incomingChallenge.timeControl ? (incomingChallenge.timeControl.increment > 0 ? `${incomingChallenge.timeControl.minutes}+${incomingChallenge.timeControl.increment}` : `${incomingChallenge.timeControl.minutes} min`) : 'Standard'}</strong> game
              </p>
              {incomingChallenge.note && (
                <div style={{
                  background: 'var(--bg-surface)',
                  padding: 'var(--space-md)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-lg)',
                  border: '1px solid var(--border-color)',
                  fontStyle: 'italic',
                  color: 'var(--text-secondary)',
                  fontSize: '14px'
                }}>
                  "{incomingChallenge.note}"
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <button className="btn btn-primary" onClick={acceptNearbyChallenge} style={{ width: '100%', fontWeight: 700 }}>
                  ✅ Accept
                </button>
                <button className="btn btn-secondary" onClick={declineNearbyChallenge} style={{ width: '100%' }}>
                  ✕ Decline
                </button>
                <button
                  onClick={blockNearbyUser}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'transparent',
                    border: '1px solid var(--accent-red)',
                    color: 'var(--accent-red)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                >
                  🚫 Block User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // MAP LOBBY PHASE
  if (phase === 'map') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 60px)', padding: 'var(--space-xl)' }}>
        {userLocation && (
          <MapLobby
            userPosition={userLocation}
            mapPlayers={mapPlayers}
            onChallenge={challengeMapPlayer}
            incomingChallenge={incomingChallenge}
            onAccept={acceptMapChallenge}
            onDecline={declineMapChallenge}
            cancelMapLobby={cancelMapLobby}
            sentChallenge={sentChallenge}
          />
        )}
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
    <>
    {incomingCall && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        backdropFilter: 'blur(4px)'
      }}>
        <div className="card" style={{ padding: 'var(--space-xl)', textAlign: 'center', maxWidth: '360px', width: '90%' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)' }}>📞</div>
          <h3 style={{ marginBottom: 'var(--space-xs)' }}>Incoming Call</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', fontSize: '16px' }}>
            Opponent wants to start a <strong>{incomingCall.mode === 'voice' ? 'Voice' : 'Video'}</strong> call.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            <button className="btn btn-primary" onClick={handleAcceptCall} style={{ width: '100%', fontWeight: 700 }}>
              ✅ Accept
            </button>
            <button className="btn btn-secondary" onClick={handleDeclineCall} style={{ width: '100%' }}>
              ✕ Decline
            </button>
          </div>
        </div>
      </div>
    )}
    <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    <div className="play-layout" id="play-online-layout">
      {/* Video Section */}
      <div className="video-section" style={{ display: showVideoSection ? 'flex' : 'none', flexDirection: 'column', gap: 'var(--space-md)', width: '240px', flexShrink: 0 }}>
        <div className="card" style={{ padding: 'var(--space-sm)', position: 'relative' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>Opponent Video</div>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            muted
            style={{ width: '100%', aspectRatio: '4/3', borderRadius: 'var(--radius-md)', objectFit: 'cover', background: '#000', display: 'block' }} 
          />
          {!remoteStream && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(30,30,30,0.8)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Waiting for opponent...</div>
          )}
        </div>
        {callMode === 'share' && (
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
        )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: opponent?.username ? 'pointer' : 'default' }}
              onClick={() => opponent?.username && setShowProfileUsername(opponent.username)}
            >
              <span style={{ fontSize: '20px' }}>👤</span>
              <span style={{ fontWeight: 600 }}>{opponent?.username || 'Opponent'}</span>
              <span className="badge badge-gold" style={{ fontSize: '11px' }}>{opponent?.rating || '?'}</span>
            </div>
            {renderCapturedPieces(
              orientation === 'white' ? captured.blackCaptured : captured.whiteCaptured,
              orientation === 'white' ? captured.blackAdvantage : captured.whiteAdvantage,
              orientation === 'white' ? 'w' : 'b'
            )}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: user?.username ? 'pointer' : 'default' }}
              onClick={() => user?.username && setShowProfileUsername(user.username)}
            >
              <span style={{ fontSize: '20px' }}>👤</span>
              <span style={{ fontWeight: 600 }}>{user?.username || 'You'}</span>
              <span className="badge badge-green" style={{ fontSize: '11px' }}>{user?.rating || '?'}</span>
            </div>
            {renderCapturedPieces(
              orientation === 'white' ? captured.whiteCaptured : captured.blackCaptured,
              orientation === 'white' ? captured.whiteAdvantage : captured.blackAdvantage,
              orientation === 'white' ? 'b' : 'w'
            )}
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
            {incomingDrawOffer ? (
              <div style={{ display: 'flex', gap: '4px', flex: '1 1 calc(50% - 4px)' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleAcceptDraw}
                  style={{ flex: 1, padding: '8px 4px', fontSize: '13px' }}
                  title="Accept Draw"
                >
                  ✅ Accept
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleDeclineDraw}
                  style={{ flex: 1, padding: '8px 4px', fontSize: '13px' }}
                  title="Decline Draw"
                >
                  ✕ Decline
                </button>
              </div>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={handleOfferDraw}
                disabled={phase !== 'playing' || hasSentDrawOffer || drawOffersCount >= 5}
                style={{ flex: '1 1 calc(50% - 4px)', opacity: (phase !== 'playing' || hasSentDrawOffer || drawOffersCount >= 5) ? 0.5 : 1 }}
                title={drawOffersCount >= 5 ? "Draw offer limit reached" : "Offer Draw"}
              >
                🤝 Draw {drawOffersCount > 0 && `(${5 - drawOffersCount})`}
              </button>
            )}
            <button
              className="btn"
              onClick={handleResign}
              disabled={phase !== 'playing'}
              style={{
                flex: '1 1 calc(50% - 4px)',
                background: 'rgba(224, 90, 90, 0.15)',
                color: 'var(--accent-red)',
                border: '1px solid rgba(224, 90, 90, 0.3)',
                opacity: phase !== 'playing' ? 0.5 : 1,
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
    </>
  );
}
