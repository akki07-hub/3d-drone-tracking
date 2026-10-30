# Indoor 3D Drone Tracking Using Multimodal Data

This project is a complete, interactive college-level simulation and dashboard for tracking a drone indoors using multimodal sensor fusion (Camera, Depth/LiDAR, and IMU). 

## Features
- **Case Study**: Detailed problem statement, objectives, methodologies, challenges, and metrics.
- **Interactive 3D Simulation**: Fly a drone in a 3D environment using `Three.js`. Obstacle detection and trajectory trailing included.
- **Live Telemetry & Dashboard**: Real-time positional, velocity, and simulated sensor data.
- **Analytics Charts**: Position tracking, altitude/velocity line charts, and error plotting using `Chart.js`.
- **Auto-Fly Demo Mode**: Automatically pilots the drone in a predefined route for demonstration.

## How to Run
1. Open the project folder.
2. Double-click on `index.html` to open it in Google Chrome (or any modern web browser).
   - *Note: If Three.js textures/models are added later, you may need a local HTTP server (like VSCode Live Server) to bypass CORS restrictions, but the current simulation runs perfectly via `file://` protocol.*
3. Use the sidebar to navigate between the Overview, Case Study, 3D Simulation, Live Dashboard, Analytics, and Architecture.
4. Go to **3D Simulation** and click **Start** to fly manually or **Auto-Fly Demo** to watch the drone fly autonomously.

## Controls
- **W, A, S, D**: Move horizontally (Forward, Left, Back, Right)
- **Q / E**: Ascend / Descend
- **Shift**: Speed Boost
- **R**: Reset position

## Structure
- `index.html` - Main structure, UI layout, and text content.
- `style.css` - Styling, dashboard layout, and dark theme.
- `script.js` - Three.js simulation, physics logic, and Chart.js integration.

## Dependencies
This project uses CDN links, so an active internet connection is required to load:
- [Three.js (r128)](https://cdnjs.com/libraries/three.js)
- [Chart.js](https://www.chartjs.org/)
