'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

export default function MapLobby({ userPosition, mapPlayers, onChallenge, incomingChallenge, onAccept, onDecline, cancelMapLobby, sentChallenge }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div style={{ minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Interactive Map...</div>;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '900px', height: '650px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      {/* Overlays for challenges */}
      {incomingChallenge && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <h2 style={{ color: 'white', marginBottom: 'var(--space-md)', fontSize: '32px' }}>Incoming Challenge!</h2>
          <div style={{ fontSize: '24px', marginBottom: 'var(--space-xl)', color: 'var(--accent-green)' }}>
            <strong>{incomingChallenge.username}</strong> ({incomingChallenge.rating})
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <button className="btn btn-primary" onClick={onAccept} style={{ padding: '12px 32px', fontSize: '18px' }}>Accept</button>
            <button className="btn btn-secondary" onClick={onDecline} style={{ padding: '12px 32px', fontSize: '18px' }}>Decline</button>
          </div>
        </div>
      )}

      {sentChallenge && (
        <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-surface)', padding: 'var(--space-md) var(--space-xl)', borderRadius: 'var(--radius-full)', zIndex: 1000, border: '1px solid var(--accent-green)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontWeight: 'bold' }}>
          Waiting for {sentChallenge} to accept...
        </div>
      )}

      <button 
        className="btn btn-secondary"
        style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--bg-surface)', fontWeight: 'bold', padding: '10px 24px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
        onClick={cancelMapLobby}
      >
        Leave Map Lobby
      </button>

      {/* Map bounds focus initially on user but zooms out to show the world */}
      <MapContainer center={[userPosition.lat, userPosition.lng]} zoom={3} style={{ height: '100%', width: '100%', background: '#aadaff' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Current User Marker */}
        <Marker position={[userPosition.lat, userPosition.lng]}>
          <Popup>
            <div style={{ textAlign: 'center', color: '#333' }}>
              <strong style={{ fontSize: '16px' }}>You</strong><br />
              <span style={{ fontSize: '12px' }}>Waiting for opponents...</span>
            </div>
          </Popup>
        </Marker>

        {/* Pulse circle around user */}
        <Circle center={[userPosition.lat, userPosition.lng]} radius={1000000} pathOptions={{ color: 'var(--accent-green)', fillColor: 'var(--accent-green)', fillOpacity: 0.1, weight: 1 }} />

        {/* Other Players */}
        {mapPlayers.map(player => (
          <Marker key={player.socketId} position={[player.lat, player.lng]}>
            <Popup>
              <div style={{ textAlign: 'center', minWidth: '150px', color: '#333' }}>
                <strong style={{ fontSize: '18px' }}>{player.username}</strong>
                <div style={{ margin: '6px 0', fontSize: '14px' }}>Rating: {player.rating}</div>
                <button 
                  style={{ width: '100%', padding: '10px', background: '#629a2a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '8px', fontWeight: 'bold' }}
                  onClick={() => onChallenge(player.socketId, player.username)}
                  disabled={!!sentChallenge}
                >
                  Challenge
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
