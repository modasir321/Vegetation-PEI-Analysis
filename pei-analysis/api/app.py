# Sentinel-2 Imagery Portal with NDVI Analysis
import ee
import json
import logging
from pathlib import Path
from flask import Flask, jsonify, request
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure paths
BASE_DIR = Path(__file__).parent
CREDENTIALS_PATH = BASE_DIR / "ee-mohammadmudassir531-747311c353f6.json"

# Earth Engine initialization
try:
    credentials = ee.ServiceAccountCredentials(
        "gee-4-9@ee-mohammadmudassir531.iam.gserviceaccount.com",
        str(CREDENTIALS_PATH)
    )
    ee.Initialize(credentials)
    logger.info("Earth Engine initialized successfully")
except Exception as e:
    logger.error("Earth Engine initialization failed: %s", str(e))
    raise


def geojson_to_ee_geometry(geojson_data):
    """Convert GeoJSON to Earth Engine geometry"""
    try:
        if isinstance(geojson_data, dict):
            # If it's a Feature, extract the geometry
            if geojson_data.get('type') == 'Feature':
                geom_dict = geojson_data.get('geometry')
            # If it's already a geometry
            elif geojson_data.get('type') in ['Polygon', 'MultiPolygon', 'Point', 'LineString']:
                geom_dict = geojson_data
            else:
                raise ValueError("Invalid GeoJSON format")
            
            # Convert to Earth Engine geometry
            ee_geom = ee.Geometry(geom_dict)
            return ee_geom
        else:
            raise ValueError("GeoJSON data must be a dictionary")
    except Exception as e:
        logger.error(f"Error converting GeoJSON to EE geometry: {str(e)}")
        raise ValueError(f"Invalid geometry format: {str(e)}")


@app.route('/')
def health_check():
    return jsonify({
        'status': 'running',
        'message': 'Vegetation Analysis App API is running',
        'endpoints': [
            '/get_imagery',
            '/get_ndvi'
        ]
    })


@app.route('/get_imagery', methods=['POST'])
def get_imagery():
    """
    Get Sentinel-2 imagery for a user-drawn polygon and date range.
    Returns true color and NDVI visualizations.
    """
    try:
        data = request.get_json()
        
        # Validate required parameters
        geometry = data.get('geometry')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if not geometry:
            raise ValueError("Geometry (polygon) is required")
        if not start_date or not end_date:
            raise ValueError("Both start_date and end_date are required")
        
        # Validate date range (max 365 days)
        date_diff = ee.Date(end_date).difference(ee.Date(start_date), 'day').getInfo()
        if date_diff > 365:
            raise ValueError("Date range exceeds 365 day limit")
        if date_diff < 0:
            raise ValueError("End date must be after start date")
        
        # Convert GeoJSON to Earth Engine geometry
        analysis_geometry = geojson_to_ee_geometry(geometry)
        
        logger.info(f"Fetching Sentinel-2 imagery for date range: {start_date} to {end_date}")
        
        # Get Sentinel-2 imagery collection
        collection = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                      .filterBounds(analysis_geometry)
                      .filterDate(start_date, end_date)
                      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 15)))
        
        collection_size = collection.size().getInfo()
        if collection_size == 0:
            raise ValueError(
                f"No Sentinel-2 images with <15% cloud cover available for selected dates "
                f"({start_date} to {end_date}). Try a longer date range or different dates."
            )
        
        logger.info(f"Found {collection_size} images with <15% cloud cover")
        
        # Create median composite to reduce cloud effects
        median_image = collection.median().clip(analysis_geometry)
        
        # Calculate NDVI: (NIR - Red) / (NIR + Red)
        # Sentinel-2 bands: B8 (NIR), B4 (Red)
        ndvi = median_image.normalizedDifference(['B8', 'B4']).rename('ndvi')
        
        # True color visualization (RGB: B4, B3, B2)
        true_color_vis = {
            'bands': ['B4', 'B3', 'B2'],
            'min': 0,
            'max': 3000,
            'gamma': 1.2
        }
        
        # NDVI visualization (green to red palette)
        ndvi_vis = {
            'min': -1,
            'max': 1,
            'palette': ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2']
        }
        
        # Get tile URLs
        true_color_tiles = median_image.visualize(**true_color_vis).getMapId()['tile_fetcher'].url_format
        ndvi_tiles = ndvi.visualize(**ndvi_vis).getMapId()['tile_fetcher'].url_format
        
        # Calculate statistics
        ndvi_stats = ndvi.reduceRegion(
            reducer=ee.Reducer.minMax().combine(
                ee.Reducer.mean().combine(
                    ee.Reducer.stdDev(),
                    '', True
                ),
                '', True
            ),
            geometry=analysis_geometry,
            scale=30,
            maxPixels=1e9
        ).getInfo()
        
        # Calculate area
        area_m2 = analysis_geometry.area(1).getInfo()
        area_km2 = round(area_m2 / 1e6, 2)
        
        return jsonify({
            'success': True,
            'true_color_tiles': true_color_tiles,
            'ndvi_tiles': ndvi_tiles,
            'statistics': {
                'ndvi_min': round(ndvi_stats.get('ndvi_min', 0), 3),
                'ndvi_max': round(ndvi_stats.get('ndvi_max', 0), 3),
                'ndvi_mean': round(ndvi_stats.get('ndvi_mean', 0), 3),
                'ndvi_stddev': round(ndvi_stats.get('ndvi_stddev', 0), 3)
            },
            'area_km2': area_km2,
            'images_found': collection_size,
            'date_range': f"{start_date} to {end_date}"
        })
        
    except Exception as e:
        logger.error("Imagery request failed: %s", str(e))
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/get_ndvi', methods=['POST'])
def get_ndvi():
    """
    Get detailed NDVI analysis for a user-drawn polygon and date range.
    Returns NDVI statistics and classification.
    """
    try:
        data = request.get_json()
        
        # Validate required parameters
        geometry = data.get('geometry')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        if not geometry:
            raise ValueError("Geometry (polygon) is required")
        if not start_date or not end_date:
            raise ValueError("Both start_date and end_date are required")
        
        # Validate date range
        date_diff = ee.Date(end_date).difference(ee.Date(start_date), 'day').getInfo()
        if date_diff > 365:
            raise ValueError("Date range exceeds 365 day limit")
        
        # Convert GeoJSON to Earth Engine geometry
        analysis_geometry = geojson_to_ee_geometry(geometry)
        
        # Get Sentinel-2 imagery collection
        collection = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                      .filterBounds(analysis_geometry)
                      .filterDate(start_date, end_date)
                      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 15)))
        
        if collection.size().getInfo() == 0:
            raise ValueError(
                f"No Sentinel-2 images with <15% cloud cover available for selected dates. "
                f"Try a longer date range or different dates."
            )
        
        # Create median composite
        median_image = collection.median().clip(analysis_geometry)
        
        # Calculate NDVI
        ndvi = median_image.normalizedDifference(['B8', 'B4']).rename('ndvi')
        
        # NDVI classification
        # -1 to 0: Water/Bare soil
        # 0 to 0.2: Sparse vegetation
        # 0.2 to 0.5: Moderate vegetation
        # 0.5 to 1: Dense vegetation
        
        water_mask = ndvi.lt(0)
        sparse_veg = ndvi.gte(0).And(ndvi.lt(0.2))
        moderate_veg = ndvi.gte(0.2).And(ndvi.lt(0.5))
        dense_veg = ndvi.gte(0.5)
        
        # Calculate area for each class
        pixel_area = ee.Image.pixelArea()
        
        def calculate_class_area(mask):
            return mask.multiply(pixel_area).reduceRegion(
                reducer=ee.Reducer.sum(),
                geometry=analysis_geometry,
                scale=30,
                maxPixels=1e9
            ).get('ndvi').getInfo() or 0
        
        water_area = calculate_class_area(water_mask)
        sparse_area = calculate_class_area(sparse_veg)
        moderate_area = calculate_class_area(moderate_veg)
        dense_area = calculate_class_area(dense_veg)
        
        total_area = water_area + sparse_area + moderate_area + dense_area
        
        # Calculate percentages
        def to_percentage(area):
            return round((area / total_area * 100) if total_area > 0 else 0, 2)
        
        # Get NDVI statistics
        ndvi_stats = ndvi.reduceRegion(
            reducer=ee.Reducer.minMax().combine(
                ee.Reducer.mean().combine(
                    ee.Reducer.percentile([25, 50, 75]),
                    '', True
                ),
                '', True
            ),
            geometry=analysis_geometry,
            scale=30,
            maxPixels=1e9
        ).getInfo()
        
        # NDVI visualization
        ndvi_vis = {
            'min': -1,
            'max': 1,
            'palette': ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2']
        }
        
        ndvi_tiles = ndvi.visualize(**ndvi_vis).getMapId()['tile_fetcher'].url_format
        
        return jsonify({
            'success': True,
            'ndvi_tiles': ndvi_tiles,
            'statistics': {
                'min': round(ndvi_stats.get('ndvi_min', 0), 3),
                'max': round(ndvi_stats.get('ndvi_max', 0), 3),
                'mean': round(ndvi_stats.get('ndvi_mean', 0), 3),
                'median': round(ndvi_stats.get('ndvi_median', 0), 3),
                'q25': round(ndvi_stats.get('ndvi_p25', 0), 3),
                'q75': round(ndvi_stats.get('ndvi_p75', 0), 3)
            },
            'classification': {
                'water': {
                    'area_km2': round(water_area / 1e6, 2),
                    'percentage': to_percentage(water_area)
                },
                'sparse_vegetation': {
                    'area_km2': round(sparse_area / 1e6, 2),
                    'percentage': to_percentage(sparse_area)
                },
                'moderate_vegetation': {
                    'area_km2': round(moderate_area / 1e6, 2),
                    'percentage': to_percentage(moderate_area)
                },
                'dense_vegetation': {
                    'area_km2': round(dense_area / 1e6, 2),
                    'percentage': to_percentage(dense_area)
                }
            },
            'total_area_km2': round(total_area / 1e6, 2),
            'date_range': f"{start_date} to {end_date}"
        })
        
    except Exception as e:
        logger.error("NDVI analysis failed: %s", str(e))
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='localhost', port=5000, debug=True)
