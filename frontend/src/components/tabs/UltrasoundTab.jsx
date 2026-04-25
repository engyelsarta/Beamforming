import React, { Component, createRef } from 'react';
import UltrasoundSidebar from '../ultrasound/UltrasoundSidebar';
import PhantomViewer from '../ultrasound/PhantomViewer';
import AModeViewer from '../ultrasound/AModeViewer';
import BModeViewer from '../ultrasound/BModeViewer';
import DopplerViewer from '../ultrasound/DopplerViewer';
import { Ultrasound_Simulator } from '../../utils/engineOOP';

export default class UltrasoundTab extends Component {
  static defaultParams = {
    freq: 5.0, // MHz
    elements: 128,
    spacing: 0.15, // mm (approx lambda/2 for 5MHz)
    steering: 0,
    scanLinesPerFrame: 1, // Number of scan lines generated per animation frame
    focalDepth: 60, // mm
    pulseLength: 2, // cycles
    snr: 40, // dB
    window: 'hamming',
    dynamicRange: 60, // dB (Dynamic Range)
    
    // Vessel defaults
    bloodVelocity: 40, // cm/s
    vesselAngle: 15, // degrees
    vesselDepth: 50, // mm
    vesselDiameter: 6, // mm
  };

  constructor(props) {
    super(props);
    this.sim = new Ultrasound_Simulator();
    
    this.state = {
      regions: null,
    };
    
    this.probePosRef = createRef();
    this.probePosRef.current = 0.5;
  }

  setPhantomRegions = (regions) => {
    this.setState({ regions });
  };

  render() {
    const { state, updateParam, isVisible } = this.props;
    const { regions } = this.state;

    // Use default params if state is missing them (first render before App merges them)
    const effectiveState = { ...UltrasoundTab.defaultParams, ...state };

    return (
      <div className="main" style={{ display: isVisible ? 'flex' : 'none' }}>
        <UltrasoundSidebar state={effectiveState} updateParam={updateParam} />

        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 1, background: 'var(--border)', overflow: 'hidden',
        }}>
           <PhantomViewer state={effectiveState} setPhantomRegions={this.setPhantomRegions} probePosRef={this.probePosRef} />
           <BModeViewer state={effectiveState} regions={regions} probePosRef={this.probePosRef} updateParam={updateParam} />
           <AModeViewer state={effectiveState} regions={regions} probePosRef={this.probePosRef} />
           <DopplerViewer state={effectiveState} probePosRef={this.probePosRef} />
        </div>
      </div>
    );
  }
}
