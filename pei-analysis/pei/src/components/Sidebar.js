import React from 'react';
import './Sidebar.css';

const Sidebar = ({ activeLayers, toggleLayer, loadImagery, analyzeCoastalChange }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-box"></div>
       
      </div>

      <h3 style={{ marginTop: '30px' }}>Layers</h3>
      <div className="checkbox-group">
        {['trueColor', 'ndwi', 'baseline', 'erosion'].map((layer) => (
          <label key={layer} className="checkbox-item">
            <input
              type="checkbox"
              checked={activeLayers.has(layer)}
              onChange={() => toggleLayer(layer)}
            />
            {layer.replace(/([A-Z])/g, ' $1').trim()}
          </label>
        ))}
      </div>

      {/* <div className="actions">
        <button onClick={loadImagery} className="btn-sidebar">Load Imagery</button>
        <button onClick={analyzeCoastalChange} className="btn-sidebar">Analyze Changes</button>
      </div> */}

    </aside>
  );
};

export default Sidebar;
