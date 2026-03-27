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
    <section
      className="panel friend-panel profile-circle-desc-panel"
      style={{ marginTop: 32, boxShadow: '0 8px 32px rgba(34, 82, 53, 0.18)', background: '#f8fff4', position: 'relative' }}
    >
      <div
        style={{
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
        }}
      >
        Circle Description
      </div>
      <div className="profile-circle-desc-list">
        {profiles.map((profile, idx) => {
          const isLeft = idx % 2 === 0;
          return (
            <div
              key={profile.id}
              className={`profile-circle-desc-item${isLeft ? ' left' : ' right'}`}
            >
              <img
                src={profile.avatar}
                alt={`${profile.name} profile`}
                className="profile-circle-desc-avatar"
                style={{ borderRadius: isLeft ? '32px 0 0 32px' : '0 32px 32px 0' }}
              />
              <div className="profile-circle-desc-content">
                <h3>{profile.name}</h3>
                <p className="role">{profile.role}</p>
                <div className="activity">{profile.favoriteActivity}</div>
                <p className="desc">{profile.description}</p>
              </div>
              <div className="profile-circle-desc-contact">
                <a
                  href={`https://wa.me/${profile.contactNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="memory-action-btn"
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
