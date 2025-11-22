import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Chart } from 'chart.js/auto';
import 'leaflet/dist/leaflet.css';
import './dashboard.css';

const Dashboard = () => {
  // Date state - using day, month, year format
  const currentDate = new Date();
  const [startDay, setStartDay] = useState('01');
  const [startMonth, setStartMonth] = useState('01');
  const [startYear, setStartYear] = useState('2023');
  const [endDay, setEndDay] = useState('31');
  const [endMonth, setEndMonth] = useState('01');
  const [endYear, setEndYear] = useState('2023');
  
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageryData, setImageryData] = useState(null);
  const [ndviData, setNdviData] = useState(null);
  const [drawnPolygon, setDrawnPolygon] = useState(null);
  
  // Helper function to format date from day, month, year
  const formatDate = (day, month, year) => {
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };
  
  // Get days in a month
  const getDaysInMonth = (month, year) => {
    return new Date(year, month, 0).getDate();
  };
  
  // Generate arrays for dropdowns
  const years = Array.from({ length: currentDate.getFullYear() - 2015 }, (_, i) => 2016 + i).reverse();
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];
  
  // Get days array based on selected month and year
  const getDaysArray = (month, year) => {
    const daysInMonth = getDaysInMonth(parseInt(month), parseInt(year));
    return Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));
  };

  const mapRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const drawControlRef = useRef(null);
  const drawnLayerRef = useRef(null);
  const layers = useRef({
    baseMap: null,
    trueColor: null,
    ndvi: null,
    customPolygon: null
  });

  useEffect(() => {
    initializeMap();
    return () => {
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

  useEffect(() => {
    if (ndviData && chartRef.current && !loading) {
      updateNDVIChart();
    }
  }, [ndviData, loading]);

  const initializeMap = () => {
    // Initialize map centered on world view
    mapRef.current = L.map('map').setView([20, 0], 2);
    layers.current.baseMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapRef.current);

    // Initialize drawn features layer
    drawnLayerRef.current = new L.FeatureGroup();
    mapRef.current.addLayer(drawnLayerRef.current);

    // Initialize draw control - allow polygon and rectangle
    drawControlRef.current = new L.Control.Draw({
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true
        },
        rectangle: {
          showArea: true
        },
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false
      },
      edit: {
        featureGroup: drawnLayerRef.current,
        remove: true
      }
    });
    mapRef.current.addControl(drawControlRef.current);

    // Handle polygon/rectangle creation
    mapRef.current.on(L.Draw.Event.CREATED, (e) => {
      const layer = e.layer;
      const geoJson = layer.toGeoJSON();
      
      // Remove previous custom polygon if exists
      if (layers.current.customPolygon) {
        drawnLayerRef.current.removeLayer(layers.current.customPolygon);
      }
      
      // Store the drawn polygon
      setDrawnPolygon(geoJson);
      
      // Add to drawn layer
      drawnLayerRef.current.addLayer(layer);
      
      // Store reference for removal
      layers.current.customPolygon = layer;
      
      // Style the polygon
      layer.setStyle({
        color: '#9b59b6',
        weight: 3,
        fillColor: '#9b59b6',
        fillOpacity: 0.2
      });
      
          layer.bindPopup(`
            <div style="font-family: Arial, sans-serif;">
          <h4 style="margin: 0 0 8px 0; color: #9b59b6;">Analysis Area</h4>
          <p style="margin: 0; font-size: 12px;">Select dates and click "Load Imagery"</p>
            </div>
          `);
      
      showSuccess('Area selected! Now select dates and click "Load Imagery & NDVI"');
    });

    // Handle polygon deletion
    mapRef.current.on(L.Draw.Event.DELETED, () => {
      setDrawnPolygon(null);
      if (layers.current.customPolygon) {
        layers.current.customPolygon = null;
      }
      clearImagery();
      showSuccess('Area cleared. Draw a new polygon to analyze.');
    });
  };

  const clearImagery = () => {
    if (layers.current.trueColor) {
      mapRef.current.removeLayer(layers.current.trueColor);
      layers.current.trueColor = null;
    }
    if (layers.current.ndvi) {
      mapRef.current.removeLayer(layers.current.ndvi);
      layers.current.ndvi = null;
    }
    setImageryData(null);
    setNdviData(null);
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
  };

  const loadImageryAndNDVI = async () => {
    if (!drawnPolygon) {
      showError('Please draw a polygon or rectangle on the map first');
      return;
    }

    try {
      setLoading(true);
      clearImagery();
      
      const startDate = formatDate(startDay, startMonth, startYear);
      const endDate = formatDate(endDay, endMonth, endYear);
      
      const requestBody = {
        geometry: drawnPolygon,
        start_date: startDate,
        end_date: endDate
      };
      
      // Load imagery and NDVI
      const response = await fetch('http://localhost:5000/get_imagery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load imagery');
      }
      
      // Add imagery layers to map
      layers.current.trueColor = L.tileLayer(data.true_color_tiles, {
        opacity: 0.8
      }).addTo(mapRef.current);
      
      layers.current.ndvi = L.tileLayer(data.ndvi_tiles, {
        opacity: 0.8
      }).addTo(mapRef.current);
      
      setImageryData(data);
      
      // Load detailed NDVI analysis
      const ndviResponse = await fetch('http://localhost:5000/get_ndvi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const ndviData = await ndviResponse.json();
      
      if (ndviData.success) {
        setNdviData(ndviData);
        showSuccess(`Imagery loaded! Found ${data.images_found} images. NDVI analysis complete.`);
      } else {
        throw new Error(ndviData.error || 'Failed to load NDVI analysis');
      }
      
    } catch (error) {
      showError(error.message || 'Failed to load satellite imagery');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateNDVIChart = () => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    if (chartRef.current && ndviData && ndviData.classification) {
      const ctx = chartRef.current.getContext('2d');
      const classification = ndviData.classification;
      
      chartInstance.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Water/Bare Soil', 'Sparse Vegetation', 'Moderate Vegetation', 'Dense Vegetation'],
          datasets: [{
            label: 'Area Coverage (%)',
            data: [
              classification.water.percentage,
              classification.sparse_vegetation.percentage,
              classification.moderate_vegetation.percentage,
              classification.dense_vegetation.percentage
            ],
            backgroundColor: [
              'rgba(54, 162, 235, 0.7)',  // Blue - Water
              'rgba(255, 206, 86, 0.7)',  // Yellow - Sparse
              'rgba(75, 192, 192, 0.7)',  // Teal - Moderate
              'rgba(75, 192, 75, 0.7)'    // Green - Dense
            ],
            borderColor: [
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
              'rgba(75, 192, 192, 1)',
              'rgba(75, 192, 75, 1)'
            ],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right'
            },
            title: {
              display: true,
              text: 'NDVI Classification Distribution'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  const index = context.dataIndex;
                  const areas = [
                    ndviData.classification.water.area_km2,
                    ndviData.classification.sparse_vegetation.area_km2,
                    ndviData.classification.moderate_vegetation.area_km2,
                    ndviData.classification.dense_vegetation.area_km2
                  ];
                  return `${label}: ${value.toFixed(2)}% (${areas[index].toFixed(2)} km²)`;
                }
              }
            }
          }
        }
      });
    }
  };

  const toggleLayer = (layerType) => {
    if (!mapRef.current) return;
    
    if (layerType === 'trueColor') {
      if (layers.current.trueColor) {
        if (mapRef.current.hasLayer(layers.current.trueColor)) {
          mapRef.current.removeLayer(layers.current.trueColor);
        } else {
          layers.current.trueColor.addTo(mapRef.current);
        }
      }
    } else if (layerType === 'ndvi') {
      if (layers.current.ndvi) {
        if (mapRef.current.hasLayer(layers.current.ndvi)) {
          mapRef.current.removeLayer(layers.current.ndvi);
        } else {
          layers.current.ndvi.addTo(mapRef.current);
        }
      }
    }
  };

  const showError = (message) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  return (
    <div className="dashboard-layout">
      <div className="dashboard-body">
        <aside className="sidebar">
          <h2>Vegetation Analysis App</h2>
          
          <div style={{ margin: '10px 0', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px', border: '1px solid #dee2e6' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#495057' }}>Instructions</h3>
            <ol style={{ fontSize: '11px', color: '#6c757d', paddingLeft: '18px', margin: '0 0 8px 0' }}>
              <li>Draw a polygon or rectangle on the map</li>
              <li>Select start and end dates</li>
              <li>Click "Load Imagery & NDVI"</li>
            </ol>
            {drawnPolygon && (
              <div style={{ marginTop: '8px', padding: '6px', backgroundColor: '#d4edda', borderRadius: '3px' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#155724' }}>✓ Area selected</p>
              </div>
            )}
          </div>
          
          <div className="date-range" style={{ margin: '10px 0' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#495057' }}>Start Date</h3>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              <select
                value={startDay}
                onChange={(e) => setStartDay(e.target.value)}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                {getDaysArray(startMonth, startYear).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              <select
                value={startMonth}
                onChange={(e) => {
                  setStartMonth(e.target.value);
                  const daysInMonth = getDaysInMonth(parseInt(e.target.value), parseInt(startYear));
                  if (parseInt(startDay) > daysInMonth) {
                    setStartDay(String(daysInMonth).padStart(2, '0'));
                  }
                }}
                style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                {months.map(month => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
              <select
                value={startYear}
                onChange={(e) => {
                  setStartYear(e.target.value);
                  const daysInMonth = getDaysInMonth(parseInt(startMonth), parseInt(e.target.value));
                  if (parseInt(startDay) > daysInMonth) {
                    setStartDay(String(daysInMonth).padStart(2, '0'));
                  }
                }}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                {years.map(year => (
                  <option key={year} value={String(year)}>{year}</option>
                ))}
              </select>
            </div>
            
            <h3 style={{ margin: '8px 0 8px 0', fontSize: '13px', color: '#495057' }}>End Date</h3>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <select
                value={endDay}
                onChange={(e) => setEndDay(e.target.value)}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                {getDaysArray(endMonth, endYear).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              <select
                value={endMonth}
                onChange={(e) => {
                  setEndMonth(e.target.value);
                  const daysInMonth = getDaysInMonth(parseInt(e.target.value), parseInt(endYear));
                  if (parseInt(endDay) > daysInMonth) {
                    setEndDay(String(daysInMonth).padStart(2, '0'));
                  }
                }}
                style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                {months.map(month => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>
              <select
                value={endYear}
                onChange={(e) => {
                  setEndYear(e.target.value);
                  const daysInMonth = getDaysInMonth(parseInt(endMonth), parseInt(e.target.value));
                  if (parseInt(endDay) > daysInMonth) {
                    setEndDay(String(daysInMonth).padStart(2, '0'));
                  }
                }}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                {years.map(year => (
                  <option key={year} value={String(year)}>{year}</option>
                ))}
              </select>
            </div>
            <p style={{ fontSize: '10px', color: '#6c757d', marginTop: '5px', marginBottom: 0 }}>
              Note: Date range must be ≤ 365 days
            </p>
          </div>
          
          <div className="actions">
            <button 
              onClick={loadImageryAndNDVI} 
              className="btn-sidebar"
              disabled={!drawnPolygon || loading}
              style={{ 
                width: '100%',
                opacity: (!drawnPolygon || loading) ? 0.6 : 1,
                cursor: (!drawnPolygon || loading) ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Loading...' : 'Load Imagery & NDVI'}
            </button>
          </div>

          {imageryData && (
            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '5px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Layer Controls</h3>
              <div className="checkbox-group">
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    onChange={() => toggleLayer('trueColor')}
                  />
                  True Color Imagery
                </label>
                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    onChange={() => toggleLayer('ndvi')}
                  />
                  NDVI Visualization
                </label>
              </div>
            </div>
          )}
        </aside>

        <main className="main-content">
          {errorMessage && (
            <div className="error-message" style={{
              backgroundColor: '#ffebee',
              color: '#c62828',
              padding: '8px',
              margin: '5px 0',
              borderRadius: '4px',
              border: '1px solid #ef9a9a',
              fontSize: '13px'
            }}>
              {errorMessage}
            </div>
          )}
          
          {successMessage && (
            <div style={{
              backgroundColor: '#e8f5e9',
              color: '#2e7d32',
              padding: '8px',
              margin: '5px 0',
              borderRadius: '4px',
              border: '1px solid #a5d6a7',
              fontSize: '13px'
            }}>
              {successMessage}
            </div>
          )}
          
          <div id="map" style={{ height: '65vh', width: '100%', marginTop: '10px', borderRadius: '8px' }}></div>
          
          {loading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <div className="loading-text">Loading Sentinel-2 Imagery...</div>
            </div>
          )}
          
          <div className="analysis-results">
            {imageryData && (
              <div className="results-summary" style={{ marginTop: '10px' }}>
                <h3>Imagery Information</h3>
                <div className="summary-item">
                  <span>Date Range:</span>
                  <span>{imageryData.date_range}</span>
                </div>
                <div className="summary-item">
                  <span>Images Found:</span>
                  <span>{imageryData.images_found}</span>
                </div>
                <div className="summary-item">
                  <span>Analysis Area:</span>
                  <span>{imageryData.area_km2} km²</span>
                </div>
              </div>
            )}

            {ndviData && (
              <div className="results-summary" style={{ marginTop: '10px' }}>
                <h3>NDVI Statistics</h3>
                <div className="summary-item">
                  <span>NDVI Min:</span>
                  <span>{ndviData.statistics.min}</span>
            </div>
                <div className="summary-item">
                  <span>NDVI Max:</span>
                  <span>{ndviData.statistics.max}</span>
                </div>
                <div className="summary-item">
                  <span>NDVI Mean:</span>
                  <span>{ndviData.statistics.mean}</span>
                </div>
                <div className="summary-item">
                  <span>NDVI Median:</span>
                  <span>{ndviData.statistics.median}</span>
                </div>

                <h4 style={{ marginTop: '10px', marginBottom: '5px' }}>NDVI Classification</h4>
                <div className="summary-item">
                  <span>Water/Bare Soil:</span>
                  <span>{ndviData.classification.water.percentage}% ({ndviData.classification.water.area_km2} km²)</span>
                </div>
                <div className="summary-item">
                  <span>Sparse Vegetation:</span>
                  <span>{ndviData.classification.sparse_vegetation.percentage}% ({ndviData.classification.sparse_vegetation.area_km2} km²)</span>
                </div>
                <div className="summary-item">
                  <span>Moderate Vegetation:</span>
                  <span>{ndviData.classification.moderate_vegetation.percentage}% ({ndviData.classification.moderate_vegetation.area_km2} km²)</span>
                </div>
                <div className="summary-item">
                  <span>Dense Vegetation:</span>
                  <span>{ndviData.classification.dense_vegetation.percentage}% ({ndviData.classification.dense_vegetation.area_km2} km²)</span>
                </div>
              </div>
            )}

            <div className="chart-container" style={{ marginTop: '10px' }}>
              <canvas ref={chartRef}></canvas>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
