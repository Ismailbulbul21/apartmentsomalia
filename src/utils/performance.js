// Performance monitoring utilities

class PerformanceMonitor {
  constructor() {
    this.timers = new Map();
    this.metrics = new Map();
  }

  // Start timing an operation
  startTimer(name) {
    this.timers.set(name, performance.now());
  }

  // End timing and record the duration
  endTimer(name) {
    const startTime = this.timers.get(name);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.timers.delete(name);
      
      // Store metric
      if (!this.metrics.has(name)) {
        this.metrics.set(name, []);
      }
      this.metrics.get(name).push(duration);
      
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
      return duration;
    }
    return 0;
  }

  // Get average time for an operation
  getAverageTime(name) {
    const times = this.metrics.get(name);
    if (!times || times.length === 0) return 0;
    
    const sum = times.reduce((a, b) => a + b, 0);
    return sum / times.length;
  }

  // Get performance report
  getReport() {
    const report = {};
    for (const [name, times] of this.metrics.entries()) {
      if (times.length > 0) {
        report[name] = {
          count: times.length,
          average: this.getAverageTime(name),
          min: Math.min(...times),
          max: Math.max(...times),
          total: times.reduce((a, b) => a + b, 0)
        };
      }
    }
    return report;
  }

  // Clear all metrics
  clear() {
    this.timers.clear();
    this.metrics.clear();
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Utility function to measure async operations
export const measureAsync = async (name, asyncFn) => {
  performanceMonitor.startTimer(name);
  try {
    const result = await asyncFn();
    performanceMonitor.endTimer(name);
    return result;
  } catch (error) {
    performanceMonitor.endTimer(name);
    throw error;
  }
};

// React hook for measuring component render times
export const usePerfTimer = (componentName) => {
  const startTime = performance.now();
  
  return () => {
    const renderTime = performance.now() - startTime;
    console.log(`🔄 ${componentName} render: ${renderTime.toFixed(2)}ms`);
  };
}; 