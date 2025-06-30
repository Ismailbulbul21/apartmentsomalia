import React, { useEffect, useState } from 'react';
import { getImageUrl, testImageUrls } from '../utils/imageUtils';

const ImageDebug = () => {
  const [testResults, setTestResults] = useState([]);
  
  useEffect(() => {
    const runTests = async () => {
      console.log('🔍 Running image debug tests...');
      
      const testPaths = [
        'apartments/1010ed08-f109-4050-ab26-e5a31a9050d8-1748111578431-704.jpeg',
        'apartments/5c627b60-0358-4ae4-a991-e04ae7156848-1748105138733-363.jpeg'
      ];
      
      const results = [];
      
      for (const path of testPaths) {
        const url = getImageUrl(path);
        console.log(`🔍 Testing path: ${path}`);
        console.log(`🔍 Generated URL: ${url}`);
        
        try {
          const response = await fetch(url, { method: 'HEAD' });
          const result = {
            path,
            url,
            status: response.status,
            success: response.ok,
            headers: Object.fromEntries(response.headers.entries())
          };
          results.push(result);
          console.log(`🔍 Result:`, result);
        } catch (error) {
          const result = {
            path,
            url,
            error: error.message,
            success: false
          };
          results.push(result);
          console.error(`🔍 Error:`, result);
        }
      }
      
      setTestResults(results);
      
      // Also run the utility test
      try {
        await testImageUrls();
      } catch (error) {
        console.error('🔍 testImageUrls error:', error);
      }
    };
    
    runTests();
  }, []);
  
  return (
    <div className="fixed top-4 right-4 bg-white shadow-lg rounded-lg p-4 max-w-md z-50 border">
      <h3 className="font-bold text-sm mb-2">🔍 Image Debug</h3>
      <div className="text-xs space-y-2">
        {testResults.map((result, index) => (
          <div key={index} className="border-b pb-2">
            <div className="font-medium">{result.path}</div>
            <div className={`${result.success ? 'text-green-600' : 'text-red-600'}`}>
              Status: {result.status || 'ERROR'}
            </div>
            {result.error && (
              <div className="text-red-500">Error: {result.error}</div>
            )}
            <div className="text-gray-500 truncate">
              URL: {result.url}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageDebug; 