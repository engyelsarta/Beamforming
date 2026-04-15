import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import VizArea from './components/VizArea';
import { computeJS } from './utils/beamformingEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState('beamforming');
  
  const [state, setState] = useState({
    elements: 16,
    spacing: 0.5,
    steering: 0,
    amplitude: 1.0,
    phase: 0,
    freq: 2.4,
    power: 30,
    snr: 20,
    waveform: 'sinusoidal',
    window: 'hamming',
  });

  const [data, setData] = useState(null);

  // Debounced computation to ensure lag-free interactions
  useEffect(() => {
    const timer = setTimeout(() => {
      const res = computeJS(state);
      setData(res);
    }, 80);
    return () => clearTimeout(timer);
  }, [state]);

  const updateParam = (key, val) => {
    setState(prev => ({ ...prev, [key]: val }));
  };

  const setWaveform = (wf) => {
    setState(prev => ({ ...prev, waveform: wf }));
  };

  const setWindow = (win) => {
    setState(prev => ({ ...prev, window: win }));
  };

  return (
    <>
      <div className="header">
        <div className="logo">
          <div className="logo-dot"></div>
          <span className="logo-title">Beamforming Simulator</span>
          <span className="logo-ver">v1.0</span>
        </div>
        <div className="nav-tabs">
          <button className={`nav-tab ${activeTab === 'beamforming' ? 'active' : ''}`} onClick={() => setActiveTab('beamforming')}>⬡ Beamforming</button>
          <button className={`nav-tab ${activeTab === '5g' ? 'active' : ''}`} onClick={() => setActiveTab('5g')}>◎ 5G Network</button>
          <button className={`nav-tab ${activeTab === 'ultrasound' ? 'active' : ''}`} onClick={() => setActiveTab('ultrasound')}>◎ Ultrasound</button>
          <button className={`nav-tab ${activeTab === 'radar' ? 'active' : ''}`} onClick={() => setActiveTab('radar')}>◑ Radar</button>
        </div>
      </div>

      <div className="main" style={{ display: activeTab === 'beamforming' ? 'flex' : 'none' }}>
        <Sidebar 
          state={state} 
          updateParam={updateParam} 
          setWaveform={setWaveform} 
          setWindow={setWindow} 
          metrics={data?.metrics}
        />
        <VizArea data={data} state={state} />
      </div>

      <div className="main" style={{ display: activeTab === '5g' ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', fontFamily: "'Orbitron', monospace", color: 'var(--text-dim)' }}>
          <div style={{ fontSize: '32px', color: 'var(--accent)', marginBottom: '16px' }}>5G NETWORK</div>
          <div style={{ fontSize: '13px', letterSpacing: '2px' }}>Module coming soon</div>
        </div>
      </div>

      <div className="main" style={{ display: activeTab === 'ultrasound' ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', fontFamily: "'Orbitron', monospace", color: 'var(--text-dim)' }}>
          <div style={{ fontSize: '32px', color: 'var(--accent2)', marginBottom: '16px' }}>ULTRASOUND</div>
          <div style={{ fontSize: '13px', letterSpacing: '2px' }}>Module coming soon</div>
        </div>
      </div>

      <div className="main" style={{ display: activeTab === 'radar' ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', fontFamily: "'Orbitron', monospace", color: 'var(--text-dim)' }}>
          <div style={{ fontSize: '32px', color: 'var(--accent3)', marginBottom: '16px' }}>RADAR</div>
          <div style={{ fontSize: '13px', letterSpacing: '2px' }}>Module coming soon</div>
        </div>
      </div>
    </>
  );
}
