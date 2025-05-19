import { memo } from 'react';
import { motion } from 'framer-motion';

const LoadingSpinner = memo(({ 
  size = 'md', 
  color = 'primary',
  thickness = 'normal',
  fullScreen = false,
  text = '',
  textSize = 'sm'
}) => {
  // Size classes
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8 md:w-10 md:h-10',
    lg: 'w-12 h-12 md:w-16 md:h-16',
    xl: 'w-16 h-16 md:w-24 md:h-24',
  };

  // Color classes
  const colorClasses = {
    primary: 'border-primary-200 border-t-primary-600',
    secondary: 'border-secondary-200 border-t-secondary-600',
    accent: 'border-accent-200 border-t-accent-600',
    white: 'border-white/20 border-t-white',
    night: 'border-night-200 border-t-night-600',
  };

  // Thickness classes
  const thicknessClasses = {
    thin: 'border-2',
    normal: 'border-3 md:border-4',
    thick: 'border-4 md:border-8',
  };
  
  // Text size classes
  const textSizeClasses = {
    xs: 'text-xs',
    sm: 'text-xs md:text-sm',
    md: 'text-sm md:text-base',
    lg: 'text-base md:text-lg',
  };

  // Animation variants
  const spinTransition = {
    repeat: Infinity,
    ease: "linear",
    duration: 1.2
  };

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-night-900/50 backdrop-blur-sm z-50">
        <motion.div
          className={`${sizeClasses[size]} ${thicknessClasses[thickness]} ${colorClasses[color]} rounded-full`}
          animate={{ rotate: 360 }}
          transition={spinTransition}
        />
        {text && (
          <p className={`mt-3 text-white ${textSizeClasses[textSize]}`}>
            {text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <motion.div
        className={`${sizeClasses[size]} ${thicknessClasses[thickness]} ${colorClasses[color]} rounded-full`}
        animate={{ rotate: 360 }}
        transition={spinTransition}
      />
      {text && (
        <p className={`mt-2 text-gray-600 ${textSizeClasses[textSize]}`}>
          {text}
        </p>
      )}
    </div>
  );
});

export default LoadingSpinner; 