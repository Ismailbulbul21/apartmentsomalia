import React, { useEffect } from 'react';
import { getImageUrl, testDirectAccess } from '../utils/imageUtils';

const ImageTest = () => {
  const testPaths = [
    'apartments/1010ed08-f109-4050-ab26-e5a31a9050d8-1748111578431-704.jpeg',
    'apartments/5c627b60-0358-4ae4-a991-e04ae7156848-1748105138733-363.jpeg'
  ];

  useEffect(() => {
    testDirectAccess();
  }, []);

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Image URL Test</h1>
      
      {testPaths.map((path, index) => {
        const url = getImageUrl(path);
        return (
          <div key={index} className="mb-8 p-4 bg-white rounded-lg shadow">
            <h3 className="font-semibold mb-2">Test Image {index + 1}</h3>
            <p className="text-sm text-gray-600 mb-2">
              <strong>Original Path:</strong> {path}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <strong>Generated URL:</strong> {url}
            </p>
            
            <div className="border border-gray-300 rounded-lg overflow-hidden w-64 h-48">
              <img 
                src={url} 
                alt={`Test image ${index + 1}`}
                className="w-full h-full object-cover"
                onLoad={() => console.log('✅ Image loaded successfully:', url)}
                onError={(e) => {
                  console.error('❌ Image failed to load:', url);
                  e.target.src = '/images/placeholder-apartment.svg';
                }}
              />
            </div>
            
            <div className="mt-2">
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                Open in new tab
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ImageTest; 