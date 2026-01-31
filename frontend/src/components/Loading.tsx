import React from 'react';

const Loading: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="loading">
    <div style={{ textAlign: 'center' }}>
      <div className="spinner" style={{ margin: '0 auto 1rem' }} />
      <p>{message}</p>
    </div>
  </div>
);

export default Loading;
