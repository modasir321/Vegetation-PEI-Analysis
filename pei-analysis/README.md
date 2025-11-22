# Sentinel-2 Imagery Portal

A web-based portal for accessing and analyzing Copernicus Sentinel-2 satellite imagery with NDVI (Normalized Difference Vegetation Index) analysis. Users can draw polygons anywhere in the world, select date ranges, and get high-quality satellite imagery with vegetation analysis.

## Features

- **Global Coverage**: Analyze any location worldwide (not limited to specific regions)
- **Interactive Polygon Drawing**: Draw custom polygons or rectangles on the map
- **Sentinel-2 Imagery**: Access Copernicus Sentinel-2 imagery from 2016 onward
- **NDVI Analysis**: Calculate and visualize Normalized Difference Vegetation Index
- **Date Range Selection**: Select any date range (up to 365 days)
- **Cloud Filtering**: Automatically filters images with <15% cloud cover
- **Visualization**: 
  - True color satellite imagery
  - NDVI color-coded visualization
  - Statistical analysis and classification

## Technology Stack

- **Frontend**: React, Leaflet.js, Chart.js
- **Backend**: Flask (Python)
- **Satellite Data**: Google Earth Engine API
- **Imagery Source**: Copernicus Sentinel-2 (COPERNICUS/S2_SR_HARMONIZED)

## Quick Start

### Prerequisites

- Python 3.7+
- Node.js 14+
- Google Earth Engine account with credentials

### Installation

1. **Install Python dependencies:**
   ```bash
   cd api
   pip install -r requirements.txt
   ```

2. **Install React dependencies:**
   ```bash
   cd pei
   npm install
   ```

3. **Configure Earth Engine credentials:**
   - Place your Earth Engine service account JSON file in the `api/` directory
   - Update the credentials path in `api/app.py` if needed

### Running the Application

**Option 1: Use the Batch Script (Windows)**
```bash
start_servers.bat
```

**Option 2: Manual Start**

1. **Start the Flask API server:**
   ```bash
   cd api
   python app.py
   ```
   - API runs on: http://localhost:5000

2. **Start the React development server:**
   ```bash
   cd pei
   npm start
   ```
   - React app runs on: http://localhost:3000

## Usage

1. **Draw an Area**: Use the polygon or rectangle drawing tool on the map to select your area of interest
2. **Select Dates**: Choose start and end dates (must be between 2016 and today, max 365 days)
3. **Load Imagery**: Click "Load Imagery & NDVI" to fetch and display:
   - True color satellite imagery
   - NDVI visualization
   - Statistical analysis

## API Endpoints

### `GET /`
Health check endpoint

### `POST /get_imagery`
Get Sentinel-2 imagery and basic NDVI visualization

**Request Body:**
```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lon1, lat1], [lon2, lat2], ...]]
  },
  "start_date": "2023-01-01",
  "end_date": "2023-01-31"
}
```

**Response:**
```json
{
  "success": true,
  "true_color_tiles": "tile_url",
  "ndvi_tiles": "tile_url",
  "statistics": {
    "ndvi_min": -0.5,
    "ndvi_max": 0.9,
    "ndvi_mean": 0.4,
    "ndvi_stddev": 0.2
  },
  "area_km2": 25.5,
  "images_found": 5,
  "date_range": "2023-01-01 to 2023-01-31"
}
```

### `POST /get_ndvi`
Get detailed NDVI analysis with classification

**Request Body:** Same as `/get_imagery`

**Response:**
```json
{
  "success": true,
  "ndvi_tiles": "tile_url",
  "statistics": {
    "min": -0.5,
    "max": 0.9,
    "mean": 0.4,
    "median": 0.45,
    "q25": 0.2,
    "q75": 0.6
  },
  "classification": {
    "water": {"area_km2": 2.5, "percentage": 10.0},
    "sparse_vegetation": {"area_km2": 5.0, "percentage": 20.0},
    "moderate_vegetation": {"area_km2": 10.0, "percentage": 40.0},
    "dense_vegetation": {"area_km2": 7.5, "percentage": 30.0}
  },
  "total_area_km2": 25.0
}
```

## NDVI Classification

- **Water/Bare Soil**: NDVI < 0
- **Sparse Vegetation**: 0 ≤ NDVI < 0.2
- **Moderate Vegetation**: 0.2 ≤ NDVI < 0.5
- **Dense Vegetation**: NDVI ≥ 0.5

## Project Structure

```
pei-analysis/
├── api/
│   ├── app.py              # Flask API server
│   ├── requirements.txt    # Python dependencies
│   └── ee-*.json          # Earth Engine credentials
├── pei/
│   ├── src/
│   │   ├── components/
│   │   │   └── Dashboard.js  # Main application component
│   │   └── App.js
│   └── package.json
└── README.md
```

## Notes

- Sentinel-2 imagery is available from 2016 onward
- Maximum date range is 365 days per request
- Images are filtered to <15% cloud cover
- The application uses median composite to reduce cloud effects
- NDVI is calculated using Sentinel-2 bands B8 (NIR) and B4 (Red)

## License

[Add your license here]
