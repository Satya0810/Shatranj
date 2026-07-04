'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

// Haversine formula to calculate distance between two lat/lng points
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export default function MapLobby({ userPosition, mapPlayers, onChallenge, incomingChallenge, onAccept, onDecline, cancelMapLobby, sentChallenge }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div style={{ minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Interactive Map...</div>;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '900px', height: '650px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      {/* Player count + distance info bar */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, background: 'rgba(15,23,42,0.85)', padding: '8px 16px', borderRadius: 'var(--radius-full)', backdropFilter: 'blur(6px)', fontSize: '13px', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#81b64a', display: 'inline-block', animation: 'pulse 2s infinite' }} />
        {mapPlayers.length} player{mapPlayers.length !== 1 ? 's' : ''} online
      </div>

      {/* Overlays for challenges */}
      {incomingChallenge && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <h2 style={{ color: 'white', marginBottom: 'var(--space-md)', fontSize: '32px' }}>Incoming Challenge!</h2>
          <div style={{ fontSize: '24px', marginBottom: 'var(--space-xl)', color: 'var(--accent-green)' }}>
            <strong>{incomingChallenge.username}</strong> ({incomingChallenge.rating})
            {incomingChallenge.lat && (
              <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '4px' }}>
                📍 {formatDistance(getDistance(userPosition.lat, userPosition.lng, incomingChallenge.lat, incomingChallenge.lng))} away
              </div>
            )}
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

      <MapContainer center={[userPosition.lat, userPosition.lng]} zoom={14} style={{ height: '100%', width: '100%', background: '#aadaff' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Current User Marker */}
        <Marker position={[userPosition.lat, userPosition.lng]}>
          <Popup>
            <div style={{ textAlign: 'center', color: '#333' }}>
              <strong style={{ fontSize: '16px' }}>📍 You</strong><br />
              <span style={{ fontSize: '12px' }}>Waiting for opponents...</span>
            </div>
          </Popup>
        </Marker>

        {/* Pulse circle around user */}
        <Circle center={[userPosition.lat, userPosition.lng]} radius={2000} pathOptions={{ color: '#81b64a', fillColor: '#81b64a', fillOpacity: 0.08, weight: 1 }} />

        {/* Dashed lines connecting you to each player */}
        {mapPlayers.map(player => (
          <Polyline
            key={`line-${player.socketId}`}
            positions={[[userPosition.lat, userPosition.lng], [player.lat, player.lng]]}
            pathOptions={{ color: '#5c9ee6', weight: 2, dashArray: '8, 6', opacity: 0.6 }}
          />
        ))}

        {/* Other Players */}
        {mapPlayers.map(player => {
          const dist = getDistance(userPosition.lat, userPosition.lng, player.lat, player.lng);
          return (
            <Marker key={player.socketId} position={[player.lat, player.lng]}>
              <Popup>
                <div style={{ textAlign: 'center', minWidth: '170px', color: '#333' }}>
                  <strong style={{ fontSize: '18px' }}>{player.username}</strong>
                  <div style={{ margin: '4px 0', fontSize: '14px' }}>⭐ Rating: {player.rating}</div>
                  <div style={{ margin: '4px 0', fontSize: '13px', color: '#5c9ee6', fontWeight: 600 }}>
                    📍 {formatDistance(dist)} away
                  </div>
                  <button 
                    style={{ width: '100%', padding: '10px', background: '#629a2a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '8px', fontWeight: 'bold', fontSize: '14px' }}
                    onClick={() => onChallenge(player.socketId, player.username)}
                    disabled={!!sentChallenge}
                  >
                    ⚔️ Challenge
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
