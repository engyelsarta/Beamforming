import React, { Component } from 'react';
import Sidebar from '../Sidebar';
import PolarPlot from '../PolarPlot';

export default class BaseTab extends Component {
  renderSidebar() {
    const { state, updateParam, updatePerSourceParam, setWaveform, setWindow, metrics } = this.props;
    return (
      <Sidebar 
        state={state} 
        updateParam={updateParam} 
        updatePerSourceParam={updatePerSourceParam}
        setWaveform={setWaveform} 
        setWindow={setWindow} 
        metrics={metrics}
      />
    );
  }

  renderSharedVisuals() {
    const { data, state } = this.props;
    return (
      <PolarPlot data={data} state={state} />
    );
  }

  renderCustomVisuals() {
    // To be implemented by subclasses
    return null;
  }

  render() {
    const { isVisible } = this.props;
    return (
      <div className="main" style={{ display: isVisible ? 'flex' : 'none' }}>
        {this.renderSidebar()}
        <div className="viz-area">
          {this.renderCustomVisuals()}
          {this.renderSharedVisuals()}
        </div>
      </div>
    );
  }
}
