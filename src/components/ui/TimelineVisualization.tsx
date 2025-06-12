"use client"

import React, { useEffect, useRef } from 'react';
if (process.env.NODE_ENV === "development") {
  console.error = () => {};
}

const TimelineVisualization = ({ 
  manualAnnotations, 
  modelData, 
  totalFrames,
  annotationPhase, // Add this parameter to know which timeline is active
  currentFrame
}) => {
  if (!totalFrames) return null;

  // Refs for the canvas elements
  const doctorCanvasRef = useRef(null);
  const patientCanvasRef = useRef(null);
  const aiDoctorCanvasRef = useRef(null);
  const aiPatientCanvasRef = useRef(null);

  // Draw annotations on canvas
  const drawAnnotations = (canvas, annotations, type, isAI = false) => {
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set background
    ctx.fillStyle = '#e5e7eb'; // Light gray (matching the bg-gray-200 class)
    ctx.fillRect(0, 0, width, height);
    
    if (!annotations || (typeof annotations === 'object' && Object.keys(annotations).length === 0)) {
      return;
    }
    
    if (isAI) {
      // For AI predictions, draw continuous ranges
      const { leftPersonGaze, leftPersonScreen, rightPersonGaze, rightPersonScreen } = 
        modelData?.[1]?.manualAnnotations || {};
      
      // Set transparency for AI predictions
      ctx.globalAlpha = 0.8;
      
      if (type === 'doctor') {
        // Process patient gaze ranges (doctor looking at patient)
        if (rightPersonGaze) {
          ctx.fillStyle = '#1bd018'; // Green
          rightPersonGaze.forEach(range => {
            const startX = (range.startFrame / totalFrames) * width;
            const endX = (range.endFrame / totalFrames) * width;
            const barWidth = Math.max(1, endX - startX); // Ensure at least 1px width
            ctx.fillRect(startX, 0, barWidth, height);
          });
        }
        
        // Process screen gaze ranges (doctor looking at screen)
        if (rightPersonScreen) {
          ctx.fillStyle = '#ef4444'; // Red (red-500)
          rightPersonScreen.forEach(range => {
            const startX = (range.startFrame / totalFrames) * width;
            const endX = (range.endFrame / totalFrames) * width;
            const barWidth = Math.max(1, endX - startX); // Ensure at least 1px width
            ctx.fillRect(startX, 0, barWidth, height);
          });
        }
      } else {
        // Process doctor gaze ranges (patient looking at doctor)
        if (leftPersonGaze) {
          ctx.fillStyle = '#ef4444'; // Blue - Same as doctor looking at screen
          leftPersonGaze.forEach(range => {
            const startX = (range.startFrame / totalFrames) * width;
            const endX = (range.endFrame / totalFrames) * width;
            const barWidth = Math.max(1, endX - startX); // Ensure at least 1px width
            ctx.fillRect(startX, 0, barWidth, height);
          });
        }
        
        // Process screen gaze ranges (patient looking at screen) - NEW
        if (leftPersonScreen) {
          ctx.fillStyle = '#ef4444'; // Red (red-500) - Same as doctor looking at patient
          leftPersonScreen.forEach(range => {
            const startX = (range.startFrame / totalFrames) * width;
            const endX = (range.endFrame / totalFrames) * width;
            const barWidth = Math.max(1, endX - startX); // Ensure at least 1px width
            ctx.fillRect(startX, 0, barWidth, height);
          });
        }
      }
      
      // Reset alpha
      ctx.globalAlpha = 1.0;
    } else {
      // For manual annotations, draw consistent 1px vertical lines
      // Group annotations by value to avoid redrawing same color multiple times
      const annotationsByValue = {};
      
      if (type === 'doctor') {
        // Initialize value groups for doctor
        annotationsByValue[1] = []; // Looking at patient
        annotationsByValue[2] = []; // Looking at screen
        annotationsByValue[3] = []; // Looking elsewhere
      } else {
        // Initialize value groups for patient
        annotationsByValue[4] = []; // Looking at doctor
        annotationsByValue[5] = []; // Looking elsewhere
        annotationsByValue[6] = []; // Looking at screen - NEW
      }
      
      // Group frames by annotation value
      Object.entries(annotations).forEach(([frame, value]) => {
        if (annotationsByValue[value]) {
          annotationsByValue[value].push(parseInt(frame));
        }
      });
      
      // Draw each group with its color
      Object.entries(annotationsByValue).forEach(([value, frames]) => {
        // Set color based on value and type
        if (type === 'doctor') {
          switch(parseInt(value)) {
            case 1: ctx.fillStyle = '#1bd018'; break; // Green
            case 2: ctx.fillStyle = '#ef4444'; break; // Red (red-500)
            case 3: ctx.fillStyle = '#9ca3af'; break; // Gray
            default: ctx.fillStyle = '#9ca3af';
          }
        } else {
          switch(parseInt(value)) {
            case 4: ctx.fillStyle = '#1bd018'; break; // Green - Same as doctor looking at patient
            case 5: ctx.fillStyle = '#ef4444'; break; // Red (red-500) - Same as doctor looking at screen
            case 6: ctx.fillStyle = '#9ca3af'; break; // Gray
            default: ctx.fillStyle = '#9ca3af';
          }
        }
        
        // Draw all frames for this value
        frames.forEach(frame => {
          const x = Math.floor((frame / totalFrames) * width);
          ctx.fillRect(x, 0, 2, height); // Increased to 2px width
        });
      });
    }
  };

  // Effect to draw annotations when dependencies change
  useEffect(() => {
    if (doctorCanvasRef.current) {
      drawAnnotations(doctorCanvasRef.current, manualAnnotations.doctor, 'doctor');
    }
    if (patientCanvasRef.current) {
      drawAnnotations(patientCanvasRef.current, manualAnnotations.patient, 'patient');
    }
    if (modelData && aiDoctorCanvasRef.current) {
      drawAnnotations(aiDoctorCanvasRef.current, modelData, 'doctor', true);
    }
    if (modelData && aiPatientCanvasRef.current) {
      drawAnnotations(aiPatientCanvasRef.current, modelData, 'patient', true);
    }
  }, [manualAnnotations, modelData, totalFrames]);

  // Helper to determine if a timeline is currently active for annotation
  const isActiveTimeline = (type) => {
    return annotationPhase === type;
  };

  // Create refs for the container divs to get their exact dimensions
  const doctorContainerRef = useRef(null);
  const patientContainerRef = useRef(null);

  // Calculate the position of the current frame marker with better precision
  const getFrameMarkerPosition = (containerRef) => {
    if (!totalFrames || !containerRef.current) return 0;
    
    // Get the actual width of the container
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    
    // Calculate the exact pixel position
    const position = (currentFrame / totalFrames) * containerWidth;
    
    // Account for the arrow's center point (half of arrow width)
    return Math.max(0, position - 8); // 8px is half the width of the arrow
  };

  return (
    <div className="space-y-4">
      {/* Doctor Human Annotations */}
      <div>
        <div className="flex items-center mb-1">
          <div className="text-sm font-medium text-gray-700 flex-grow flex items-center">
            {isActiveTimeline('doctor') && (
              <svg width="20" height="20" viewBox="0 0 24 24" className="text-blue-500 mr-1">
                <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/>
              </svg>
            )}
            Doctor Gaze Annotations
          </div>
        </div>
        <div className="relative" ref={doctorContainerRef}>
          <canvas 
            ref={doctorCanvasRef}
            width={1000}
            height={16}
            className={`w-full h-4 rounded ${isActiveTimeline('doctor') ? 'ring-2 ring-blue-500' : ''}`}
          />
          
          {/* Current frame indicator for Doctor timeline */}
          {isActiveTimeline('doctor') && (
            <div 
              className="absolute bottom-0 transform translate-y-full"
              style={{ 
                left: `${getFrameMarkerPosition(doctorContainerRef)}px`, 
                marginTop: '2px',
                pointerEvents: 'none' // Ensure it doesn't interfere with clicks
              }}
            >
              <svg width="16" height="10" viewBox="0 0 16 10" className="text-red-500">
                <polygon points="8,0 16,10 0,10" fill="currentColor"/>
              </svg>
            </div>
          )}
        </div>
      </div>
      
      {/* Doctor AI Predictions */}
      {modelData && (
        <div>
          <div className="flex items-center mb-1">
            <div className="text-sm font-medium text-gray-700 flex-grow">
              AI Doctor Gaze Predictions
            </div>
          </div>
          <canvas 
            ref={aiDoctorCanvasRef}
            width={1000}
            height={16}
            className="w-full h-4 rounded"
          />
        </div>
      )}
      
      {/* Patient Human Annotations */}
      <div>
        <div className="flex items-center mb-1">
          <div className="text-sm font-medium text-gray-700 flex-grow flex items-center">
            {isActiveTimeline('patient') && (
              <svg width="20" height="20" viewBox="0 0 24 24" className="text-blue-500 mr-1">
                <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/>
              </svg>
            )}
            Patient Gaze Annotations
          </div>
        </div>
        <div className="relative" ref={patientContainerRef}>
          <canvas 
            ref={patientCanvasRef}
            width={1000}
            height={16}
            className={`w-full h-4 rounded ${isActiveTimeline('patient') ? 'ring-2 ring-blue-500' : ''}`}
          />
          
          {/* Current frame indicator for Patient timeline */}
          {isActiveTimeline('patient') && (
            <div 
              className="absolute bottom-0 transform translate-y-full"
              style={{ 
                left: `${getFrameMarkerPosition(patientContainerRef)}px`, 
                marginTop: '2px',
                pointerEvents: 'none' // Ensure it doesn't interfere with clicks
              }}
            >
              <svg width="16" height="10" viewBox="0 0 16 10" className="text-red-500">
                <polygon points="8,0 16,10 0,10" fill="currentColor"/>
              </svg>
            </div>
          )}
        </div>
      </div>
      
      {/* Patient AI Predictions */}
      {modelData && (
        <div>
          <div className="flex items-center mb-1">
            <div className="text-sm font-medium text-gray-700 flex-grow">
              AI Patient Gaze Predictions
            </div>
          </div>
          <canvas 
            ref={aiPatientCanvasRef}
            width={1000}
            height={16}
            className="w-full h-4 rounded"
          />
        </div>
      )}
    </div>
  );
};

export default TimelineVisualization;