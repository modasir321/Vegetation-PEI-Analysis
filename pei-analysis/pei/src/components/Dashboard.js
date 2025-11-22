import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Chart } from 'chart.js/auto';
import 'leaflet/dist/leaflet.css';
import { 
  FiSettings, 
  FiBarChart2, 
  FiTrendingUp, 
  FiMap,
  FiCalendar, 
  FiLayers, 
  FiCheckCircle,
  FiInfo,
  FiDownload,
  FiRefreshCw,
  FiActivity,
  FiMaximize2
} from 'react-icons/fi';
import './dashboard.css';

const Dashboard = () => {
  // Tab state
  const [activeTab, setActiveTab] = useState('parameters');
  
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
  const [loadingProgress, setLoadingProgress] = useState({ step: 0, message: '', imagesFound: 0 });
  const [imageryData, setImageryData] = useState(null);
  const [ndviData, setNdviData] = useState(null);
  const [drawnPolygon, setDrawnPolygon] = useState(null);
  const [layersVisible, setLayersVisible] = useState({
    trueColor: true,
    ndvi: true
  });
  
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
  const panelContentRef = useRef(null);
  const layers = useRef({
    baseMap: null,
    trueColor: null,
    ndvi: null,
    customPolygon: null
  });

  useEffect(() => {
    initializeMap();
    // Trigger map resize after a short delay to ensure container is fully rendered
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 100);
    
    // Also invalidate size on window resize
    const handleResize = () => {
      if (mapRef.current) {
        setTimeout(() => {
          mapRef.current.invalidateSize();
        }, 100);
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      if (mapRef.current) mapRef.current.remove();
    };
  }, []);

  useEffect(() => {
    if (ndviData && chartRef.current && !loading) {
      updateNDVIChart();
    }
  }, [ndviData, loading]);

  // Reset scroll position when tab changes
  useEffect(() => {
    if (panelContentRef.current) {
      panelContentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  // Recreate chart when switching to results tab if data exists
  useEffect(() => {
    if (activeTab === 'results' && ndviData && !loading) {
      // Small delay to ensure DOM is ready and canvas is rendered
      const timer = setTimeout(() => {
        if (chartRef.current) {
          updateNDVIChart();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, ndviData, loading]);

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
      setActiveTab('parameters');
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
      
      // Step 1: Fetching imagery
      setLoadingProgress({ step: 1, message: 'Fetching Sentinel-2 imagery...', imagesFound: 0 });
      
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
      
      // Step 2: Processing images
      setLoadingProgress({ step: 2, message: `Processing ${data.images_found} images...`, imagesFound: data.images_found });
      
      // Add imagery layers to map
      layers.current.trueColor = L.tileLayer(data.true_color_tiles, {
        opacity: 0.8
      }).addTo(mapRef.current);
      
      layers.current.ndvi = L.tileLayer(data.ndvi_tiles, {
        opacity: 0.8
      }).addTo(mapRef.current);
      
      setImageryData(data);
      
      // Step 3: Loading NDVI analysis
      setLoadingProgress({ step: 3, message: 'Analyzing NDVI data...', imagesFound: data.images_found });
      
      // Load detailed NDVI analysis
      const ndviResponse = await fetch('http://localhost:5000/get_ndvi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const ndviData = await ndviResponse.json();
      
      if (ndviData.success) {
        // Step 4: Complete
        setLoadingProgress({ step: 4, message: 'Complete!', imagesFound: data.images_found });
        setNdviData(ndviData);
        showSuccess(`Imagery loaded! Found ${data.images_found} images. NDVI analysis complete.`);
        setActiveTab('results');
      } else {
        throw new Error(ndviData.error || 'Failed to load NDVI analysis');
      }
      
    } catch (error) {
      showError(error.message || 'Failed to load satellite imagery');
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingProgress({ step: 0, message: '', imagesFound: 0 });
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
    
    const newState = !layersVisible[layerType];
    setLayersVisible(prev => ({
      ...prev,
      [layerType]: newState
    }));
    
    if (layerType === 'trueColor') {
      if (layers.current.trueColor) {
        if (newState) {
          // Layer should be ON - add it if not already on map
          if (!mapRef.current.hasLayer(layers.current.trueColor)) {
            layers.current.trueColor.addTo(mapRef.current);
          }
        } else {
          // Layer should be OFF - remove it if on map
          if (mapRef.current.hasLayer(layers.current.trueColor)) {
            mapRef.current.removeLayer(layers.current.trueColor);
          }
        }
      }
    } else if (layerType === 'ndvi') {
      if (layers.current.ndvi) {
        if (newState) {
          // Layer should be ON - add it if not already on map
          if (!mapRef.current.hasLayer(layers.current.ndvi)) {
            layers.current.ndvi.addTo(mapRef.current);
          }
        } else {
          // Layer should be OFF - remove it if on map
          if (mapRef.current.hasLayer(layers.current.ndvi)) {
            mapRef.current.removeLayer(layers.current.ndvi);
          }
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

  // Export functions
  const generateReport = () => {
    if (!ndviData || !imageryData) {
      showError('No data available to generate report');
      return;
    }

    const reportData = {
      title: 'Vegetation Analysis Report',
      date: new Date().toLocaleString(),
      analysisDate: imageryData.date_range,
      area: imageryData.area_km2,
      imagesFound: imageryData.images_found,
      ndviStats: ndviData.statistics,
      classification: ndviData.classification,
      totalArea: ndviData.total_area_km2 || imageryData.area_km2
    };

    // Generate HTML report
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Vegetation Analysis Report</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; color: #333; }
    .report-container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-radius: 8px; }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    h1 { color: #2563eb; margin: 0 0 10px 0; }
    .meta { color: #666; font-size: 14px; }
    .section { margin: 30px 0; }
    .section h2 { color: #1e293b; border-left: 4px solid #2563eb; padding-left: 15px; margin-bottom: 20px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 8px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1e293b; }
    .classification-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .classification-table th, .classification-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    .classification-table th { background: #f8fafc; font-weight: 600; color: #1e293b; }
    .classification-table tr:hover { background: #f8fafc; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <h1>${reportData.title}</h1>
      <div class="meta">Generated: ${reportData.date}<br>Analysis Period: ${reportData.analysisDate}</div>
    </div>
    <div class="section">
      <h2>Analysis Overview</h2>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Analysis Area</div><div class="stat-value">${reportData.area} km²</div></div>
        <div class="stat-card"><div class="stat-label">Images Processed</div><div class="stat-value">${reportData.imagesFound}</div></div>
        <div class="stat-card"><div class="stat-label">Mean NDVI</div><div class="stat-value">${reportData.ndviStats.mean}</div></div>
        <div class="stat-card"><div class="stat-label">NDVI Range</div><div class="stat-value">${reportData.ndviStats.min} - ${reportData.ndviStats.max}</div></div>
      </div>
    </div>
    <div class="section">
      <h2>NDVI Statistics</h2>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Minimum</div><div class="stat-value">${reportData.ndviStats.min}</div></div>
        <div class="stat-card"><div class="stat-label">Maximum</div><div class="stat-value">${reportData.ndviStats.max}</div></div>
        <div class="stat-card"><div class="stat-label">Mean</div><div class="stat-value">${reportData.ndviStats.mean}</div></div>
        <div class="stat-card"><div class="stat-label">Median</div><div class="stat-value">${reportData.ndviStats.median}</div></div>
      </div>
    </div>
    <div class="section">
      <h2>Vegetation Classification</h2>
      <table class="classification-table">
        <thead><tr><th>Category</th><th>Area (km²)</th><th>Percentage</th></tr></thead>
        <tbody>
          <tr><td>Water/Bare Soil</td><td>${reportData.classification.water.area_km2}</td><td>${reportData.classification.water.percentage}%</td></tr>
          <tr><td>Sparse Vegetation</td><td>${reportData.classification.sparse_vegetation.area_km2}</td><td>${reportData.classification.sparse_vegetation.percentage}%</td></tr>
          <tr><td>Moderate Vegetation</td><td>${reportData.classification.moderate_vegetation.area_km2}</td><td>${reportData.classification.moderate_vegetation.percentage}%</td></tr>
          <tr><td>Dense Vegetation</td><td>${reportData.classification.dense_vegetation.area_km2}</td><td>${reportData.classification.dense_vegetation.percentage}%</td></tr>
        </tbody>
      </table>
    </div>
    <div class="footer"><p>Generated by Vegetation Analysis App</p><p>Data Source: Sentinel-2 Satellite Imagery</p></div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vegetation-analysis-report-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    showSuccess('Report generated and downloaded successfully!');
  };

  const exportDataAsJSON = () => {
    if (!ndviData || !imageryData) {
      showError('No data available to export');
      return;
    }

    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        analysisDate: imageryData.date_range,
        area_km2: imageryData.area_km2,
        images_found: imageryData.images_found
      },
      imagery: imageryData,
      ndvi: ndviData
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vegetation-analysis-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    showSuccess('Data exported as JSON successfully!');
  };

  const exportChartAsImage = () => {
    if (!chartRef.current || !chartInstance.current) {
      showError('Chart not available');
      return;
    }

    const chart = chartInstance.current;
    const url = chart.toBase64Image();
    const link = document.createElement('a');
    link.href = url;
    link.download = `ndvi-classification-chart-${new Date().toISOString().split('T')[0]}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Chart exported as image successfully!');
  };

  // Zoom to polygon or loaded data
  const zoomToArea = () => {
    if (!mapRef.current) {
      showError('Map not available');
      return;
    }

    // If we have a drawn polygon, zoom to it
    if (drawnPolygon && layers.current.customPolygon) {
      try {
        const bounds = layers.current.customPolygon.getBounds();
        mapRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 18
        });
        showSuccess('Zoomed to analysis area');
      } catch (error) {
        console.error('Error zooming to polygon:', error);
        showError('Failed to zoom to area');
      }
    } else if (drawnPolygon) {
      // If polygon exists but layer reference is missing, recreate bounds from GeoJSON
      try {
        const coordinates = drawnPolygon.geometry.coordinates[0];
        const latlngs = coordinates.map(coord => [coord[1], coord[0]]);
        const bounds = L.latLngBounds(latlngs);
        mapRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 18
        });
        showSuccess('Zoomed to analysis area');
      } catch (error) {
        console.error('Error zooming to polygon:', error);
        showError('Failed to zoom to area');
      }
    } else {
      showError('No area selected. Please draw a polygon first.');
    }
  };

  const sidebarTabs = [
    { id: 'parameters', icon: FiSettings, label: 'Parameters' },
    { id: 'results', icon: FiBarChart2, label: 'Results' },
    { id: 'analytics', icon: FiTrendingUp, label: 'Analytics' },
    { id: 'export', icon: FiDownload, label: 'Export' }
  ];

  return (
    <div className="dashboard-layout">
      <div className="dashboard-body">
        {/* Static Vertical Icon Bar */}
        <nav className="icon-sidebar">
          <div className="icon-sidebar-header">
            <FiMap className="icon-logo" />
          </div>
          <div className="icon-nav-container">
            {sidebarTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`icon-nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                >
                  <Icon className="icon-nav-icon" />
                  {activeTab === tab.id && <div className="icon-active-indicator"></div>}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Panel Content Area */}
        <aside className="panel-sidebar">
          <div className="panel-header-top">
            <h2 className="panel-title">Vegetation Analysis</h2>
          </div>

          <div className="panel-content-area" ref={panelContentRef}>
            {activeTab === 'parameters' && (
              <div className="tab-panel">
                <div className="panel-header">
                  <FiSettings className="panel-icon" />
                  <h3>Parameters</h3>
                </div>

                {/* Instructions Card */}
                <div className="info-card">
                  <div className="info-card-header">
                    <FiInfo className="info-icon" />
                    <h4>Instructions</h4>
                  </div>
                  <ol className="instructions-list">
                    <li>Draw a polygon or rectangle on the map</li>
                    <li>Select start and end dates</li>
                    <li>Click "Load Imagery & NDVI"</li>
                  </ol>
                  {drawnPolygon && (
                    <div className="status-badge success">
                      <FiCheckCircle />
                      <span>Area selected</span>
                    </div>
                  )}
                </div>

                {/* Date Selection */}
                <div className="date-selection-card">
                  <div className="card-header">
                    <FiCalendar className="card-icon" />
                    <h4>Date Range</h4>
                  </div>

                  <div className="date-group">
                    <label className="date-label">Start Date</label>
                    <div className="date-inputs">
                      <select
                        value={startDay}
                        onChange={(e) => setStartDay(e.target.value)}
                        className="date-select"
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
                        className="date-select month"
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
                        className="date-select"
                      >
                        {years.map(year => (
                          <option key={year} value={String(year)}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="date-group">
                    <label className="date-label">End Date</label>
                    <div className="date-inputs">
                      <select
                        value={endDay}
                        onChange={(e) => setEndDay(e.target.value)}
                        className="date-select"
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
                        className="date-select month"
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
                        className="date-select"
                      >
                        {years.map(year => (
                          <option key={year} value={String(year)}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="date-note">
                    Note: Date range must be ≤ 365 days
                  </p>
                </div>

                {/* Load Button */}
                <button 
                  onClick={loadImageryAndNDVI} 
                  className="btn-primary-modern"
                  disabled={!drawnPolygon || loading}
                >
                  {loading ? (
                    <>
                      <FiRefreshCw className="spinning" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <FiDownload />
                      <span>Load Imagery & NDVI</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {activeTab === 'results' && (
              <div className="tab-panel">
                <div className="panel-header">
                  <FiBarChart2 className="panel-icon" />
                  <h3>Results & Analysis</h3>
                </div>

                {!imageryData && !ndviData ? (
                  <div className="empty-state">
                    <FiBarChart2 className="empty-icon" />
                    <p>No data loaded yet</p>
                    <p className="empty-hint">Go to Parameters tab to load imagery</p>
                  </div>
                ) : (
                  <>
                    {imageryData && (
                      <div className="results-card">
                        <div className="card-header">
                          <FiInfo className="card-icon" />
                          <h4>Imagery Information</h4>
                        </div>
                        <div className="results-grid">
                          <div className="result-item">
                            <span className="result-label">Date Range:</span>
                            <span className="result-value">{imageryData.date_range}</span>
                          </div>
                          <div className="result-item">
                            <span className="result-label">Images Found:</span>
                            <span className="result-value">{imageryData.images_found}</span>
                          </div>
                          <div className="result-item">
                            <span className="result-label">Analysis Area:</span>
                            <span className="result-value">{imageryData.area_km2} km²</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {ndviData && (
                      <>
                        <div className="results-card">
                          <div className="card-header">
                            <FiBarChart2 className="card-icon" />
                            <h4>NDVI Statistics</h4>
                          </div>
                          <div className="results-grid">
                            <div className="result-item">
                              <span className="result-label">NDVI Min:</span>
                              <span className="result-value">{ndviData.statistics.min}</span>
                            </div>
                            <div className="result-item">
                              <span className="result-label">NDVI Max:</span>
                              <span className="result-value">{ndviData.statistics.max}</span>
                            </div>
                            <div className="result-item">
                              <span className="result-label">NDVI Mean:</span>
                              <span className="result-value">{ndviData.statistics.mean}</span>
                            </div>
                            <div className="result-item">
                              <span className="result-label">NDVI Median:</span>
                              <span className="result-value">{ndviData.statistics.median}</span>
                            </div>
                          </div>
                        </div>

                        <div className="results-card">
                          <div className="card-header">
                            <FiBarChart2 className="card-icon" />
                            <h4>NDVI Classification</h4>
                          </div>
                          <div className="classification-grid">
                            <div className="classification-item">
                              <div className="class-color water"></div>
                              <div className="class-info">
                                <span className="class-label">Water/Bare Soil</span>
                                <span className="class-value">
                                  {ndviData.classification.water.percentage}% ({ndviData.classification.water.area_km2} km²)
                                </span>
                              </div>
                            </div>
                            <div className="classification-item">
                              <div className="class-color sparse"></div>
                              <div className="class-info">
                                <span className="class-label">Sparse Vegetation</span>
                                <span className="class-value">
                                  {ndviData.classification.sparse_vegetation.percentage}% ({ndviData.classification.sparse_vegetation.area_km2} km²)
                                </span>
                              </div>
                            </div>
                            <div className="classification-item">
                              <div className="class-color moderate"></div>
                              <div className="class-info">
                                <span className="class-label">Moderate Vegetation</span>
                                <span className="class-value">
                                  {ndviData.classification.moderate_vegetation.percentage}% ({ndviData.classification.moderate_vegetation.area_km2} km²)
                                </span>
                              </div>
                            </div>
                            <div className="classification-item">
                              <div className="class-color dense"></div>
                              <div className="class-info">
                                <span className="class-label">Dense Vegetation</span>
                                <span className="class-value">
                                  {ndviData.classification.dense_vegetation.percentage}% ({ndviData.classification.dense_vegetation.area_km2} km²)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Chart in Results Tab - Always render when data exists */}
                        {ndviData && (
                          <div className="results-card chart-card-panel">
                            <div className="card-header">
                              <FiBarChart2 className="card-icon" />
                              <h4>NDVI Classification Distribution</h4>
                            </div>
                            <div className="chart-wrapper-panel">
                              <canvas 
                                ref={chartRef}
                                style={{ display: 'block' }}
                              ></canvas>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="tab-panel">
                <div className="panel-header">
                  <FiTrendingUp className="panel-icon" />
                  <h3>Analytics & Insights</h3>
                </div>

                {!ndviData ? (
                  <div className="empty-state">
                    <FiTrendingUp className="empty-icon" />
                    <p>No analysis data available</p>
                    <p className="empty-hint">Load imagery to view advanced analytics</p>
                  </div>
                ) : (
                  <>
                    {/* Vegetation Health Score */}
                    {ndviData && (
                      <div className="results-card">
                        <div className="card-header">
                          <FiActivity className="card-icon" />
                          <h4>Vegetation Health Score</h4>
                        </div>
                        {(() => {
                          const meanNDVI = parseFloat(ndviData.statistics.mean);
                          const densePct = parseFloat(ndviData.classification.dense_vegetation.percentage);
                          const moderatePct = parseFloat(ndviData.classification.moderate_vegetation.percentage);
                          
                          // Calculate health score (0-100)
                          // Based on: mean NDVI (40%), dense vegetation % (35%), moderate vegetation % (25%)
                          const ndviScore = Math.max(0, Math.min(100, (meanNDVI + 1) * 50)); // Normalize -1 to 1 -> 0 to 100
                          const denseScore = densePct * 0.35;
                          const moderateScore = moderatePct * 0.25;
                          const healthScore = Math.round(ndviScore * 0.4 + denseScore + moderateScore);
                          
                          let healthStatus = 'Poor';
                          let healthColor = '#ef4444';
                          if (healthScore >= 70) {
                            healthStatus = 'Excellent';
                            healthColor = '#10b981';
                          } else if (healthScore >= 50) {
                            healthStatus = 'Good';
                            healthColor = '#3b82f6';
                          } else if (healthScore >= 30) {
                            healthStatus = 'Fair';
                            healthColor = '#f59e0b';
                          }
                          
                          return (
                            <div className="health-score-container">
                              <div className="health-score-display" style={{ '--score': healthScore, '--color': healthColor }}>
                                <div className="health-score-value">{healthScore}</div>
                                <div className="health-score-label">/ 100</div>
                              </div>
                              <div className="health-status" style={{ color: healthColor }}>
                                <FiActivity />
                                <span>{healthStatus} Vegetation Health</span>
                              </div>
                              <div className="health-breakdown">
                                <div className="breakdown-item">
                                  <span>Mean NDVI:</span>
                                  <span>{ndviData.statistics.mean}</span>
                                </div>
                                <div className="breakdown-item">
                                  <span>Dense Coverage:</span>
                                  <span>{densePct}%</span>
                                </div>
                                <div className="breakdown-item">
                                  <span>Moderate Coverage:</span>
                                  <span>{moderatePct}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Advanced Statistics */}
                    {ndviData && ndviData.statistics.q25 && (
                      <div className="results-card">
                        <div className="card-header">
                          <FiBarChart2 className="card-icon" />
                          <h4>Advanced Statistics</h4>
                        </div>
                        <div className="stats-grid">
                          <div className="stat-box">
                            <div className="stat-label">Quartile 25%</div>
                            <div className="stat-value">{ndviData.statistics.q25}</div>
                            <div className="stat-desc">Lower quartile</div>
                          </div>
                          <div className="stat-box">
                            <div className="stat-label">Median</div>
                            <div className="stat-value">{ndviData.statistics.median}</div>
                            <div className="stat-desc">50th percentile</div>
                          </div>
                          <div className="stat-box">
                            <div className="stat-label">Quartile 75%</div>
                            <div className="stat-value">{ndviData.statistics.q75}</div>
                            <div className="stat-desc">Upper quartile</div>
                          </div>
                          <div className="stat-box">
                            <div className="stat-label">IQR</div>
                            <div className="stat-value">
                              {((parseFloat(ndviData.statistics.q75) - parseFloat(ndviData.statistics.q25)).toFixed(3))}
                            </div>
                            <div className="stat-desc">Interquartile Range</div>
                          </div>
                        </div>
                        <div className="stat-insight">
                          <FiInfo className="insight-icon" />
                          <span>
                            {(() => {
                              const iqr = parseFloat(ndviData.statistics.q75) - parseFloat(ndviData.statistics.q25);
                              if (iqr < 0.2) {
                                return 'Low variability: Uniform vegetation distribution across the area.';
                              } else if (iqr < 0.4) {
                                return 'Moderate variability: Mixed vegetation types present.';
                              } else {
                                return 'High variability: Diverse vegetation patterns with significant variation.';
                              }
                            })()}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Distribution Analysis */}
                    {ndviData && (
                      <div className="results-card">
                        <div className="card-header">
                          <FiTrendingUp className="card-icon" />
                          <h4>NDVI Distribution Analysis</h4>
                        </div>
                        <div className="distribution-analysis">
                          <div className="distribution-item">
                            <div className="dist-label">Value Range</div>
                            <div className="dist-bar-container">
                              <div className="dist-bar">
                                <div 
                                  className="dist-segment water" 
                                  style={{ width: '20%' }}
                                  title="Water/Bare Soil: NDVI < 0"
                                ></div>
                                <div 
                                  className="dist-segment sparse" 
                                  style={{ width: '20%' }}
                                  title="Sparse: 0 ≤ NDVI < 0.2"
                                ></div>
                                <div 
                                  className="dist-segment moderate" 
                                  style={{ width: '30%' }}
                                  title="Moderate: 0.2 ≤ NDVI < 0.5"
                                ></div>
                                <div 
                                  className="dist-segment dense" 
                                  style={{ width: '30%' }}
                                  title="Dense: NDVI ≥ 0.5"
                                ></div>
                              </div>
                            </div>
                            <div className="dist-values">
                              <span>{ndviData.statistics.min}</span>
                              <span className="dist-mean">Mean: {ndviData.statistics.mean}</span>
                              <span>{ndviData.statistics.max}</span>
                            </div>
                          </div>
                          
                          {ndviData.statistics.q25 && (
                            <div className="quartile-info">
                              <div className="quartile-row">
                                <span>Q1 (25%):</span>
                                <span className="quartile-value">{ndviData.statistics.q25}</span>
                              </div>
                              <div className="quartile-row">
                                <span>Median (50%):</span>
                                <span className="quartile-value">{ndviData.statistics.median}</span>
                              </div>
                              <div className="quartile-row">
                                <span>Q3 (75%):</span>
                                <span className="quartile-value">{ndviData.statistics.q75}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Data Quality Metrics */}
                    {imageryData && (
                      <div className="results-card">
                        <div className="card-header">
                          <FiInfo className="card-icon" />
                          <h4>Data Quality Metrics</h4>
                        </div>
                        <div className="quality-metrics">
                          <div className="quality-item">
                            <span className="quality-label">Images Used:</span>
                            <span className="quality-value">{imageryData.images_found}</span>
                            <span className="quality-status">
                              {imageryData.images_found >= 5 ? '✓ Good' : imageryData.images_found >= 2 ? '⚠ Fair' : '⚠ Low'}
                            </span>
                          </div>
                          <div className="quality-item">
                            <span className="quality-label">Date Range:</span>
                            <span className="quality-value">{imageryData.date_range}</span>
                          </div>
                          <div className="quality-item">
                            <span className="quality-label">Analysis Area:</span>
                            <span className="quality-value">{imageryData.area_km2} km²</span>
                          </div>
                          <div className="quality-note">
                            <FiInfo />
                            <span>
                              {imageryData.images_found >= 5 
                                ? 'High-quality composite: Multiple images provide robust median values.'
                                : imageryData.images_found >= 2
                                ? 'Moderate quality: Limited images may affect accuracy.'
                                : 'Low image count: Results may have higher uncertainty.'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Insights & Recommendations */}
                    {ndviData && (
                      <div className="results-card insights-card">
                        <div className="card-header">
                          <FiTrendingUp className="card-icon" />
                          <h4>Insights & Recommendations</h4>
                        </div>
                        <div className="insights-list">
                          {(() => {
                            const insights = [];
                            const meanNDVI = parseFloat(ndviData.statistics.mean);
                            const densePct = parseFloat(ndviData.classification.dense_vegetation.percentage);
                            const sparsePct = parseFloat(ndviData.classification.sparse_vegetation.percentage);
                            const waterPct = parseFloat(ndviData.classification.water.percentage);
                            
                            // Generate insights based on data
                            if (meanNDVI > 0.5) {
                              insights.push({
                                type: 'positive',
                                icon: '✓',
                                text: 'High average NDVI indicates healthy, dense vegetation coverage.'
                              });
                            } else if (meanNDVI < 0.2) {
                              insights.push({
                                type: 'warning',
                                icon: '⚠',
                                text: 'Low average NDVI suggests sparse vegetation or potential degradation.'
                              });
                            }
                            
                            if (densePct > 40) {
                              insights.push({
                                type: 'positive',
                                icon: '✓',
                                text: `Strong vegetation density: ${densePct}% of area has dense vegetation (NDVI ≥ 0.5).`
                              });
                            }
                            
                            if (sparsePct > 30) {
                              insights.push({
                                type: 'info',
                                icon: 'ℹ',
                                text: `Significant sparse vegetation area (${sparsePct}%) may indicate areas needing attention.`
                              });
                            }
                            
                            if (waterPct > 20) {
                              insights.push({
                                type: 'info',
                                icon: 'ℹ',
                                text: `Water/bare soil covers ${waterPct}% of the analysis area.`
                              });
                            }
                            
                            const vegCoverage = densePct + parseFloat(ndviData.classification.moderate_vegetation.percentage);
                            if (vegCoverage > 60) {
                              insights.push({
                                type: 'positive',
                                icon: '✓',
                                text: `Excellent overall vegetation coverage: ${vegCoverage.toFixed(1)}% of area has moderate to dense vegetation.`
                              });
                            }
                            
                            if (ndviData.statistics.max > 0.7) {
                              insights.push({
                                type: 'positive',
                                icon: '✓',
                                text: 'Peak NDVI values indicate areas with very healthy, thriving vegetation.'
                              });
                            }
                            
                            return insights.length > 0 ? insights.map((insight, idx) => (
                              <div key={idx} className={`insight-item insight-${insight.type}`}>
                                <span className="insight-icon">{insight.icon}</span>
                                <span className="insight-text">{insight.text}</span>
                              </div>
                            )) : (
                              <div className="insight-item insight-info">
                                <span className="insight-icon">ℹ</span>
                                <span className="insight-text">Analysis complete. Review classification data for detailed insights.</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'export' && (
              <div className="tab-panel">
                <div className="panel-header">
                  <FiDownload className="panel-icon" />
                  <h3>Export & Download</h3>
                </div>

                {!ndviData || !imageryData ? (
                  <div className="empty-state">
                    <FiDownload className="empty-icon" />
                    <p>No data available to export</p>
                    <p className="empty-hint">Load imagery to enable export options</p>
                  </div>
                ) : (
                  <>
                    {/* Export Report */}
                    <div className="results-card">
                      <div className="card-header">
                        <FiDownload className="card-icon" />
                        <h4>Generate Report</h4>
                      </div>
                      <p className="export-description">
                        Download a comprehensive HTML report with all analysis results, statistics, and classification data.
                      </p>
                      <button 
                        onClick={generateReport}
                        className="btn-export"
                      >
                        <FiDownload />
                        <span>Download HTML Report</span>
                      </button>
                    </div>

                   

                    {/* Export Chart */}
                   

                    {/* Export Information */}
                    <div className="results-card">
                      <div className="card-header">
                        <FiInfo className="card-icon" />
                        <h4>Export Information</h4>
                      </div>
                      <div className="export-info-list">
                        <div className="export-info-item">
                          <span className="info-label">Analysis Date:</span>
                          <span className="info-value">{imageryData.date_range}</span>
                        </div>
                        <div className="export-info-item">
                          <span className="info-label">Area Analyzed:</span>
                          <span className="info-value">{imageryData.area_km2} km²</span>
                        </div>
                        <div className="export-info-item">
                          <span className="info-label">Images Processed:</span>
                          <span className="info-value">{imageryData.images_found}</span>
                        </div>
                        <div className="export-info-item">
                          <span className="info-label">Export Date:</span>
                          <span className="info-value">{new Date().toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Note about Map Images */}
                    <div className="results-card">
                      <div className="card-header">
                        <FiInfo className="card-icon" />
                        <h4>Map Imagery</h4>
                      </div>
                      <p className="export-note">
                        <FiInfo className="note-icon" />
                        <span>
                          The map imagery is served as tiles and cannot be directly downloaded. 
                          To capture the map view, use your browser's screenshot tools or print-to-PDF feature.
                        </span>
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area - Full View Map */}
        <main className="main-content-modern">
          {/* Alert Messages */}
          {errorMessage && (
            <div className="alert alert-error">
              <FiInfo />
              <span>{errorMessage}</span>
            </div>
          )}
          
          {successMessage && (
            <div className="alert alert-success">
              <FiCheckCircle />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Map Container - Full View */}
          <div className="map-container-full">
            <div id="map"></div>
            {loading && (
              <div className="loading-progress-overlay">
                <div className="loading-progress-card">
                  <div className="loading-progress-header">
                    <FiRefreshCw className="spinning" />
                    <h3>Loading Imagery</h3>
                  </div>
                  <div className="loading-progress-content">
                    <div className="progress-steps">
                      <div className={`progress-step ${loadingProgress.step >= 1 ? 'active' : ''} ${loadingProgress.step > 1 ? 'completed' : ''}`}>
                        <div className="step-indicator"></div>
                        <span>Fetching imagery</span>
                      </div>
                      <div className={`progress-step ${loadingProgress.step >= 2 ? 'active' : ''} ${loadingProgress.step > 2 ? 'completed' : ''}`}>
                        <div className="step-indicator"></div>
                        <span>Processing images</span>
                      </div>
                      <div className={`progress-step ${loadingProgress.step >= 3 ? 'active' : ''} ${loadingProgress.step > 3 ? 'completed' : ''}`}>
                        <div className="step-indicator"></div>
                        <span>Analyzing NDVI</span>
                      </div>
                      <div className={`progress-step ${loadingProgress.step >= 4 ? 'active' : ''} ${loadingProgress.step > 4 ? 'completed' : ''}`}>
                        <div className="step-indicator"></div>
                        <span>Complete</span>
                      </div>
                    </div>
                    <div className="progress-message">
                      {loadingProgress.message}
                      {loadingProgress.imagesFound > 0 && (
                        <span className="images-count"> ({loadingProgress.imagesFound} images found)</span>
                      )}
                    </div>
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar" 
                        style={{ width: `${(loadingProgress.step / 4) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Zoom to Area Button */}
            {drawnPolygon && (
              <button 
                className="zoom-to-area-btn"
                onClick={zoomToArea}
                title="Zoom to analysis area"
              >
                <FiMaximize2 />
                <span>Zoom to Area</span>
              </button>
            )}

            {/* Layer Controls Overlay on Map */}
            {imageryData && (
              <div className="layer-controls-overlay">
                <div className="layer-controls-header">
                  <FiLayers className="layer-controls-icon" />
                  <h4>Layer Controls</h4>
                </div>
                <div className="layer-controls-content">
                  <label className="layer-checkbox-item">
                    <input
                      type="checkbox"
                      checked={layersVisible.trueColor}
                      onChange={() => toggleLayer('trueColor')}
                    />
                    <span>True Color Imagery</span>
                  </label>
                  <label className="layer-checkbox-item">
                    <input
                      type="checkbox"
                      checked={layersVisible.ndvi}
                      onChange={() => toggleLayer('ndvi')}
                    />
                    <span>NDVI Visualization</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
