# Beamforming Simulator - Frontend

The frontend of the Beamforming Simulator suite, built with React and Vite. It features a high-performance physics engine for real-time wave simulation.

## Features

- **Multi-Tab Simulation**: Toggle between Beamforming, 5G, Ultrasound, and Radar modes.
- **Native Physics Engine**: Custom-built `engineOOP.js` for efficient wave propagation calculations.
- **Interactive Map**: Drag-and-drop 5G towers and users for real-time signal analysis.
- **Advanced Visualizations**:
  - Polar Plots
  - Radar Scanning
  - Signal History
  - Heatmaps

## Project Structure

- `src/components/`: UI components and specialized plot components (Polar, Radar, Cartesian).
- `src/utils/engineOOP.js`: The core object-oriented physics engine.
- `src/tabs/`: Tab-specific layout and logic.

## Setup

```bash
npm install
npm run dev
```

## Physics Engine Details

The engine (`engineOOP.js`) implements:
- Phased array signal modeling.
- Array gain calculations.
- Path loss models for 5G (frequency-dependent).
- Radar cross-section and Doppler shift simulations.
