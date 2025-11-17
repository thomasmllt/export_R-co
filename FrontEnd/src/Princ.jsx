import React from 'react';
import { useNavigate } from 'react-router-dom';

const Princ = () => {
    const navigate = useNavigate();

    const handleBlockClick = () => {
        navigate('/carte');
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <title>Balise R-Co</title>
            <div
                onClick={handleBlockClick}
                style={{
                    width: 300,
                    height: 200,
                    background: '#4A90E2',
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: 24,
                    borderRadius: 16,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
            >
                Aller à la carte
            </div>
        </div>
    );
};

export default Princ;