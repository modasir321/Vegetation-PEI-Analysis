# PEI Coastal Analysis - Setup Instructions

## Quick Start

### Option 1: Use the Batch Script (Windows)
1. Double-click `start_servers.bat` to start both servers automatically

### Option 2: Manual Start
1. **Start the Flask API server:**
   ```cmd
   cd api
   python app.py
   ```
   - API will run on: http://localhost:5000

2. **Start the React development server:**
   ```cmd
   cd pei
   npm start
   ```
   - React app will run on: http://localhost:3000

## Access the Application
- Open your browser and go to: **http://localhost:3000**
- The React app will automatically connect to the Flask API on port 5000

## API Endpoints
- Health check: http://localhost:5000/
- Baseline data: http://localhost:5000/get_baseline
- Shoreline data: http://localhost:5000/get_shoreline_data
- Imagery: http://localhost:5000/get_imagery
- Change analysis: http://localhost:5000/analyze_change

## Troubleshooting
- Make sure both servers are running
- Check that no other applications are using ports 3000 or 5000
- Ensure all Python dependencies are installed: `pip install -r api/requirements.txt`
- Ensure React dependencies are installed: `cd pei && npm install`

## Current Status
✅ Fixed 2016 shoreline baseline calculation
✅ Added validation against official PEI area (5,686.03 km²)
✅ Corrected analysis labels and descriptions
✅ Improved error handling for geometry processing