import React from 'react';
import './App.css';

export type ProfileDescProps = {
  profiles: Array<{
    id: number;
    name: string;
    role: string;
    favoriteActivity: string;
    avatar: string;
    description: string;
    contactNumber: string; // added
  }>;
};

const ProfileCircleDesc: React.FC<ProfileDescProps> = ({ profiles }) => {
  return (
    <section className="panel friend-panel" style={{ marginTop: 32, /* border: '2px solid #7bb883', */ boxShadow: '0 8px 32px rgba(34, 82, 53, 0.18)', background: '#f8fff4', position: 'relative' }}>
      <div style={{
        position: 'absolute',
        top: -18,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(140deg, #6c8c58, #45643e)',
        color: '#f7fff5',
        padding: '0.3rem 1.5rem',
        borderRadius: 12,
        fontWeight: 700,
        fontSize: '1.1rem',
        boxShadow: '0 2px 8px #0002',
        letterSpacing: 1,
        zIndex: 2,
        border: 'none',
      }}>Circle Description</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 32 }}>
        {profiles.map((profile, idx) => {
          const isLeft = idx % 2 === 0;
          return (
            <div
              key={profile.id}
              style={{
                display: 'flex',
                flexDirection: isLeft ? 'row' : 'row-reverse',
                alignItems: 'center',
                background: '#f6fff3',
                border: '1.5px solid #b6e2c1',
                borderRadius: 24,
                boxShadow: '0 2px 12px #b6e2c133',
                padding: '1.2rem 2rem',
                gap: 32,
                minHeight: 180,
                width: '100%',
              }}
            >
              <img
                src={profile.avatar}
                alt={`${profile.name} profile`}
                style={{
                  width: 150,
                  height: 150,
                  objectFit: 'cover',
                  borderRadius: isLeft ? '32px 0 0 32px' : '0 32px 32px 0',
                  border: '3px solid #7bb883',
                  boxShadow: '0 2px 8px #7bb88333',
                  background: '#fff',
                  flexShrink: 0,
                  transition: 'border-radius 0.3s',
                }}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                <h3 style={{ color: '#5a7d5a', fontWeight: 700, fontSize: '1.3rem', margin: 0 }}>{profile.name}</h3>
                <p style={{ color: '#7bb883', fontWeight: 600, margin: '0.2rem 0 0.5rem' }}>{profile.role}</p>
                <div style={{ color: '#4e6e4e', fontSize: '1.05rem', fontWeight: 500 }}>{profile.favoriteActivity}</div>
                <p style={{ color: '#3a4e3a', marginTop: 8 }}>{profile.description}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                <a
                  href={`https://wa.me/${profile.contactNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="memory-action-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 48,
                    minWidth: 120,
                    fontSize: '1rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    marginLeft: isLeft ? 24 : 0,
                    marginRight: isLeft ? 0 : 24,
                  }}
                >
                  Contact
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ProfileCircleDesc;
