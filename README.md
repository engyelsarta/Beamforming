# Beamforming Simulator Suite

Beamforming, phased arrays, and direction of arrival (DOA) are fundamental concepts in modern technologies, ranging from wireless communications, 5G, radar, and sonar to biomedical applications like ultrasound and tumor ablations. The core ideas of beamforming are delays, phase-shifts, and constructive/destructive interference, which are all direct applications of Fourier transform properties.

A comprehensive suite of physics-based simulators for Beamforming, 5G Networking, Ultrasound, and Radar systems. This project provides real-time visualizations and analytical tools for understanding wave propagation and signal processing.

<img width="1909" height="908" alt="Screenshot 2026-04-27 105436" src="https://github.com/user-attachments/assets/c9e7b3f2-24f3-4d34-9f2d-7c9432300a1c" />

## Applications

### 1. Beamforming Simulator
- **Physics Principles**: Utilizes the principle of constructive and destructive interference of waves. By adjusting the phase and amplitude of individual wave sources, the simulator demonstrates how phased arrays can focus energy in specific directions.
- **Key Concepts**:
  - Phased Array Antennas: Used to steer beams without physically moving the antenna.
  - Superposition Principle: Explains how waves combine to form interference patterns.
- **Features**:
  - Visualizes wave interference patterns.
  - Interactive adjustment of source parameters.
  - Real-time computation of phased array dynamics.
    

https://github.com/user-attachments/assets/283984db-a6b1-4d82-8a8f-b14f3d470dbf



### 2. 5G Network Simulator
- **Physics Principles**: Based on electromagnetic wave propagation and beam steering. The simulator models how high-frequency waves interact with obstacles and how beamforming enhances signal strength and coverage.
- **Key Concepts**:
  - MIMO (Multiple Input Multiple Output): Enables multiple users to connect to a single tower by using multiple antennas for simultaneous data streams.
  - Beamforming: Directs signals to specific users, improving efficiency and reducing interference.
  - Path Loss Models: Simulates signal attenuation over distance and through obstacles.
- **Features**:
  - Simulates 5G signal propagation in a network map.
  - Dynamic beam steering towards user equipment.
  - Coverage analysis based on frequency and array gain.
    

https://github.com/user-attachments/assets/26560195-7c42-4ae0-bf49-a5024eb920e4



### 3. Ultrasound Simulator
- **Physics Principles**: Demonstrates the propagation of ultrasonic waves through different media. The simulator incorporates the physics of reflection, refraction, and attenuation to mimic medical imaging.
- **Key Concepts**:
  - Acoustic Impedance: Governs the reflection and transmission of ultrasound waves at boundaries.
  - Doppler Effect: Used to measure blood flow velocity in medical imaging.
  - Time-Gain Compensation: Adjusts for signal attenuation at greater depths.
- **Features**:
  - Simulates ultrasonic wave interactions.
  - Focuses on medical imaging principles and phased array transducers.
  - Includes A-Mode, B-Mode, Doppler, and Phantom viewers for detailed analysis.


https://github.com/user-attachments/assets/dacc6964-8918-4588-8f18-31e9c42a26d2



### 4. Radar Simulator
- **Physics Principles**: Explores the Doppler effect, radar cross-section, and signal reflection. The simulator visualizes how radar systems detect and track objects using electromagnetic waves.
- **Key Concepts**:
  - Pulse-Doppler Radar: Measures velocity and distance of objects.
  - Radar Cross Section (RCS): Determines how detectable an object is by radar.
  - FMCW (Frequency Modulated Continuous Wave): Used for high-resolution range and velocity measurements.
- **Features**:
  - Real-time radar scanning and object detection.
  - Signal history and Doppler effect visualization.
  - Interactive radar environment configuration.
  - Polar and Cartesian plots for radar data representation.

https://github.com/user-attachments/assets/9f561954-33db-4e2a-9b42-bb45a8a7e281



## Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.10+

### Installation

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Backend
```bash
cd backend
pip install -r requirements.txt
# uvicorn main:app --reload
```

## Technologies Used
- **Frontend**: React, Vite, Canvas API, Custom Physics Engine.
- **Backend**: FastAPI, NumPy, SciPy.

## Features

### Frontend Features
- Modular React components for each simulator (e.g., `CartesianPlot`, `FieldPlot`, `RadarSidebar`).
- Dynamic visualizations using the Canvas API.
- Tabs for switching between simulators (e.g., Beamforming, 5G, Radar, Ultrasound).

### Backend Features
- Placeholder for advanced data processing and storage.
- Designed to integrate with the frontend for real-time updates.

## How to Use

1. Clone the repository.
2. Install the prerequisites.
3. Start the frontend and backend servers.
4. Open the frontend in your browser to interact with the simulators.

## Future Enhancements
- Backend integration for real-time data processing.
- Enhanced 3D visualizations.
- Support for additional signal processing algorithms.
