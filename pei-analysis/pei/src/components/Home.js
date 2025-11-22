import React from 'react';
import { NavLink } from 'react-router-dom';

import backgroundImage from '../images/img3.jpg'; // Adjust if your path differs

const Home = () => {
  const features = [
    {
      icon: 'bi bi-bar-chart-line feature-icon',
      title: 'Satellite Image',
      description: 'Real-time tracking of coastal changes using satellite imagery'
    },
    {
      icon: 'bi bi-graph-up',
      title: 'Erosion Analytics',
      description: 'Advanced predictive models for erosion risk assessment'
    },
    {
      icon: 'bi bi-clock-history',
      title: 'High-Resolution Baseline',
      description: '2016 Sentinel-2 baseline for precise coastal change analysis'
    },
    {
      icon: 'bi bi-bell',
      title: 'Community Alerts',
      description: 'Instant notifications for critical erosion events'
    }
  ];

  return (
    <div
      className="page-hero home-hero"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
      }}
    >
      <div className="hero-overlay">
        <div className="home-content">

          {/* Hero Section */}
          <div className="hero-section">
            <h1 className="hero-title">
              Protecting PEI's Coastlines
              <span className="hero-subtitle">
                Advanced Monitoring System for Coastal Preservation
              </span>
            </h1>

            <div className="cta-buttons">
              <NavLink to="/dashboard" className="btn btn-primary">
                <i className="bi bi-speedometer2"></i>
                Explore Dashboard
              </NavLink>
              <NavLink to="/services" className="btn btn-secondary">
                <i className="bi bi-info-circle"></i>
                Learn More
              </NavLink>
            </div>
          </div>

          {/* Features Grid */}
          <div className="features-section">
            <h2 className="section-title">Key Features of Dashboard</h2>
            <div className="features-grid">
              {features.map((feature, index) => (
                <div key={index} className="feature-card">
                  <i className={`${feature.icon} feature-icon`}></i>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Section */}
          <div className="stats-section">
            <div className="stats-container">
              <div className="stat-card">
                <div className="stat-value">150+</div>
                <div className="stat-label">KM Coastline Monitored</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">24/7</div>
                <div className="stat-label">Real-Time Monitoring</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">95%</div>
                <div className="stat-label">Accuracy Rate</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Home;

