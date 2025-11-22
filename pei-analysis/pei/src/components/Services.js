import React from 'react';

const Services = () => {
  return (
    <div className="page-hero services-hero">
      <div className="hero-overlay">
        <div className="glass-card container mx-auto p-4">
          <h2 className="section-heading text-white text-center mb-8">Our Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { 
                title: 'Satellite Monitoring',
                description: 'Comprehensive satellite monitoring solutions for coastal management.'
              },
              { 
                title: 'Erosion Prediction',
                description: 'Comprehensive erosion prediction solutions for coastal management.'
              },
              { 
                title: 'Risk Assessment',
                description: 'Comprehensive risk assessment solutions for coastal management.'
              },
              { 
                title: 'Historical Analysis',
                description: 'Comprehensive historical analysis solutions for coastal management.'
              },
              { 
                title: 'Prevention Planning',
                description: 'Comprehensive prevention planning solutions for coastal management.'
              },
              { 
                title: 'Community Alerts',
                description: 'Comprehensive community alerts solutions for coastal management.'
              }
            ].map((service, index) => (
              <div key={index} className="service-card p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-3 text-white">{service.title}</h3>
                <p className="text-gray-200">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Services;