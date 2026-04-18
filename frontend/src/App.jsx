import React, { useState, useEffect, useRef } from 'react';
import BeamformingTab from './components/tabs/BeamformingTab';
import FiveGTab from './components/tabs/FiveGTab';
import UltrasoundTab from './components/tabs/UltrasoundTab';
import RadarTab from './components/tabs/RadarTab';
import { 
  Beamforming_Simulator, 
  FiveG_Simulator, 
  Ultrasound_Simulator, 
  Radar_Simulator 
} from './utils/engineOOP';

const tabs = {
  beamforming: { tab: BeamformingTab, createSim: () => new Beamforming_Simulator() },
  '5g': { tab: FiveGTab, createSim: () => new FiveG_Simulator() },
  ultrasound: { tab: UltrasoundTab, createSim: () => new Ultrasound_Simulator() },
  radar: { tab: RadarTab, createSim: () => new Radar_Simulator() }
};

export default function App() {
  const [activeTab, setActiveTab] = useState('beamforming');
  
  // Initialize with BeamformingTab's default params
  const [state, setState] = useState(BeamformingTab.defaultParams);
  const [data, setData] = useState(null);

  // Maintain separate engine instances per tab to preserve unique physical states
  const engines = useRef({
    beamforming: tabs.beamforming.createSim(),
    '5g': tabs['5g'].createSim(),
    ultrasound: tabs.ultrasound.createSim(),
    radar: tabs.radar.createSim()
  });

  // When activeTab changes, update global state to the tab's specific default parameters
  useEffect(() => {
    const ActiveComponent = tabs[activeTab].tab;
    if (ActiveComponent && ActiveComponent.defaultParams) {
      setState(prev => ({ ...prev, ...ActiveComponent.defaultParams }));
    }
  }, [activeTab]);

  // Debounced computation to ensure lag-free interactions traversing object-oriented physical engine
  useEffect(() => {
    const timer = setTimeout(() => {
      const activeSim = engines.current[activeTab];
      if(activeSim) {
         // Optionally passes perSourceParams from state if defined in the future
         const res = activeSim.update_view(state, state.perSourceParams || null);
         setData(res);
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [state, activeTab]);

  const updateParam = (key, val) => {
    setState(prev => ({ ...prev, [key]: val }));
  };

  const updatePerSourceParam = (index, key, val) => {
    setState(prev => {
      const perSourceParams = prev.perSourceParams ? { ...prev.perSourceParams } : {};
      if (!perSourceParams[index]) perSourceParams[index] = {};
      perSourceParams[index] = { ...perSourceParams[index], [key]: val };
      return { ...prev, perSourceParams };
    });
  };

  const setWaveform = (wf) => {
    setState(prev => ({ ...prev, waveform: wf }));
  };

  const setWindow = (win) => {
    setState(prev => ({ ...prev, window: win }));
  };

  const ActiveTabComponent = tabs[activeTab].tab;

  return (
    <>
      <div className="header">
        <div className="logo">
          <div className="logo-dot"></div>
          <span className="logo-title">Beamforming Simulator</span>
          <span className="logo-ver">v2.0 Native Physics Engine</span>
        </div>
        <div className="nav-tabs">
          <button className={`nav-tab ${activeTab === 'beamforming' ? 'active' : ''}`} onClick={() => setActiveTab('beamforming')}>⬡ Beamforming</button>
          <button className={`nav-tab ${activeTab === '5g' ? 'active' : ''}`} onClick={() => setActiveTab('5g')}>◎ 5G Network</button>
          <button className={`nav-tab ${activeTab === 'ultrasound' ? 'active' : ''}`} onClick={() => setActiveTab('ultrasound')}>◎ Ultrasound</button>
          <button className={`nav-tab ${activeTab === 'radar' ? 'active' : ''}`} onClick={() => setActiveTab('radar')}>◑ Radar</button>
        </div>
      </div>

      {ActiveTabComponent && (
        <ActiveTabComponent
          isVisible={true}
          state={state}
          data={data}
          updateParam={updateParam}
          updatePerSourceParam={updatePerSourceParam}
          setWaveform={setWaveform}
          setWindow={setWindow}
          metrics={data?.metrics}
        />
      )}
    </>
  );
}
