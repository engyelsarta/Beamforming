import React from 'react';
import BaseTab from './BaseTab';
import FieldPlot from '../FieldPlot';
import CartesianPlot from '../CartesianPlot';

export default class BeamformingTab extends BaseTab {
  static defaultParams = {
    elements: 16,
    spacing: 0.5,
    steering: 0,
    amplitude: 1.0,
    phase: 0,
    freq: 2.4,
    power: 30,
    snr: 500,
    pulseDuration: 10.0,
    waveform: 'sinusoidal',
    window: 'rectangular',
  };

  renderCustomVisuals() {
    const { data, state } = this.props;
    return (
      <>
        <FieldPlot data={data} state={state} />
        <CartesianPlot data={data} state={state} />
      </>
    );
  }
}
