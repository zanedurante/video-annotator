"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera } from 'lucide-react';
import TimelineVisualization from '../ui/TimelineVisualization';

const VideoAnnotator = () => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [frameInterval, setFrameInterval] = useState(50);
  const [annotationPhase, setAnnotationPhase] = useState('doctor'); // 'doctor' or 'patient'
  const [continuousAnnotationInterval, setContinuousAnnotationInterval] = useState(null);
  const [video, setVideo] = useState(null);
  const [modelData, setModelData] = useState(null);
  const [annotations, setAnnotations] = useState({
    doctor: {},  // Format: { frameNumber: annotationValue }
    patient: {}
  });
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Handle video file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const url = URL.createObjectURL(file);
      setVideo(url);
      
      const videoEl = document.createElement('video');
      videoEl.src = url;
      
      await new Promise((resolve) => {
        videoEl.onloadedmetadata = () => {
          const frames = Math.round(videoEl.duration * 30); // Assuming 30fps
          setTotalFrames(frames);
          setCurrentFrame(0);
          
          if (videoRef.current) {
            videoRef.current.src = url;
            videoRef.current.currentTime = 0;
          }
          resolve();
        };
      });
    } catch (error) {
      console.error('Error loading video:', error);
      alert('Error loading video. Please try another file.');
    }
  };

  // Update canvas with current frame
  const updateFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
    }
  }, []);

  // Handle frame navigation
  const navigateFrames = useCallback((amount) => {
    setCurrentFrame(prev => {
      const next = prev + amount;
      return Math.max(0, Math.min(next, totalFrames));
    });
  }, [totalFrames]);

  const addAnnotationAndAdvance = useCallback((value) => {
    const annotationType = annotationPhase;
    setAnnotations(prev => ({
      ...prev,
      [annotationType]: { ...prev[annotationType], [currentFrame]: value }
    }));
    navigateFrames(frameInterval);
  }, [annotationPhase, currentFrame, frameInterval, navigateFrames]);

  // Start continuous annotation
  const startContinuousAnnotation = useCallback((value) => {
    addAnnotationAndAdvance(value);
    const interval = setInterval(() => {
      addAnnotationAndAdvance(value);
    }, 100);
    setContinuousAnnotationInterval(interval);
  }, [addAnnotationAndAdvance]);

  // Stop continuous annotation
  const stopContinuousAnnotation = useCallback(() => {
    if (continuousAnnotationInterval) {
      clearInterval(continuousAnnotationInterval);
      setContinuousAnnotationInterval(null);
    }
  }, [continuousAnnotationInterval]);

  // Handle keyboard controls
  const handleKeyDown = useCallback((event) => {
    if (event.repeat) return; // Prevent multiple keydown events while holding

    if (event.code === 'ArrowLeft') {
      navigateFrames(-frameInterval);
    } else if (event.code === 'ArrowRight') {
      navigateFrames(frameInterval);
    }
    
    // Doctor phase controls
    if (annotationPhase === 'doctor' && ['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
      const value = parseInt(event.code.replace('Digit', ''));
      startContinuousAnnotation(value);
    }
    // Patient phase controls
    else if (annotationPhase === 'patient' && ['Digit4', 'Digit5'].includes(event.code)) {
      const value = parseInt(event.code.replace('Digit', ''));
      startContinuousAnnotation(value);
    }
  }, [frameInterval, navigateFrames, annotationPhase, startContinuousAnnotation]);

  // Handle key up to stop continuous annotation
  const handleKeyUp = useCallback((event) => {
    if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(event.code)) {
      stopContinuousAnnotation();
    }
  }, [stopContinuousAnnotation]);

  // Set up keyboard listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stopContinuousAnnotation();
    };
  }, [handleKeyDown, handleKeyUp, stopContinuousAnnotation]);

  // Update video frame when currentFrame changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = currentFrame / 30;
    }
  }, [currentFrame]);

  // Set up video event listeners
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.addEventListener('seeked', updateFrame);
      return () => videoRef.current?.removeEventListener('seeked', updateFrame);
    }
  }, [updateFrame]);

  const calculateDetailedAccuracyStats = (userAnnotations, modelData, type) => {
    if (!modelData || !userAnnotations || Object.keys(userAnnotations).length === 0) {
      return null;
    }

    const getModelGazeStatus = (frame, gazeRanges) => {
      return gazeRanges.some(range => frame >= range.startFrame && frame <= range.endFrame);
    };

    let metrics = {};
    
    if (type === 'doctor') {
      // Initialize counters for doctor metrics
      metrics = {
        patientGaze: { correct: 0, total: 0 },
        screenGaze: { correct: 0, total: 0 }
      };

      Object.entries(userAnnotations).forEach(([frame, value]) => {
        const frameNum = parseInt(frame);
        const modelPatientGaze = getModelGazeStatus(frameNum, modelData[1]?.manualAnnotations?.leftPersonGaze || []);
        const userPatientGaze = value === 1;
        const userScreenGaze = value === 2;

        // Patient gaze accuracy
        if (userPatientGaze || modelPatientGaze) {
          metrics.patientGaze.total++;
          if (userPatientGaze === modelPatientGaze) {
            metrics.patientGaze.correct++;
          }
        }

        // Screen gaze accuracy
        if (userScreenGaze) {
          metrics.screenGaze.total++;
          // Since we don't have screen gaze in model data, we'll count it when user annotates it
          if (userScreenGaze && !modelPatientGaze) {
            metrics.screenGaze.correct++;
          }
        }
      });
    } else {
      // Initialize counter for patient metrics
      metrics = {
        doctorGaze: { correct: 0, total: 0 }
      };

      Object.entries(userAnnotations).forEach(([frame, value]) => {
        const frameNum = parseInt(frame);
        const modelDoctorGaze = getModelGazeStatus(frameNum, modelData[1]?.manualAnnotations?.rightPersonGaze || []);
        const userDoctorGaze = value === 4;

        if (userDoctorGaze || modelDoctorGaze) {
          metrics.doctorGaze.total++;
          if (userDoctorGaze === modelDoctorGaze) {
            metrics.doctorGaze.correct++;
          }
        }
      });
    }

    return metrics;
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="space-y-6">
        {/* Controls Guide */}
        <div className="grid grid-cols-3 gap-8 p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-medium mb-2">Navigation</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>←: Previous Frame</li>
              <li>→: Next Frame</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Doctor Controls (First)</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>1: Looking at Patient</li>
              <li>2: Looking at Screen</li>
              <li>3: Looking Elsewhere</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Patient Controls (Second)</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>4: Looking at Doctor</li>
              <li>5: Looking Elsewhere</li>
            </ul>
          </div>
        </div>

        {/* File Upload and Controls */}
        <div className="flex items-center gap-4">
          <div className="flex gap-4 flex-wrap">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Upload Video</label>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 
                         file:rounded-md file:border-0 file:text-sm file:font-semibold 
                         file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Upload Model Predictions</label>
              <input
                type="file"
                accept=".json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const text = await file.text();
                    try {
                      const data = JSON.parse(text);
                      setModelData(data);
                    } catch (error) {
                      console.error('Error parsing JSON:', error);
                      alert('Error parsing changes.json file');
                    }
                  }
                }}
                className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 
                         file:rounded-md file:border-0 file:text-sm file:font-semibold 
                         file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Frames per Click</label>
              <select
                value={frameInterval}
                onChange={(e) => setFrameInterval(Number(e.target.value))}
                className="block rounded-md border-gray-300 shadow-sm px-4 py-2"
              >
                <option value="1">1 frame</option>
                <option value="10">10 frames</option>
                <option value="20">20 frames</option>
                <option value="50">50 frames</option>
                <option value="200">200 frames</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">&nbsp;</label>
              <button 
                onClick={() => {
                  setAnnotations({ doctor: {}, patient: {} });
                  setAnnotationPhase('doctor');
                  setCurrentFrame(0);
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                  }
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                Reset Annotations
              </button>
            </div>
          </div>
        </div>

        {/* Video Display */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="hidden"
            preload="auto"
            playsInline
          >
            <source type="video/mp4" />
          </video>
          
          <canvas 
            ref={canvasRef}
            className="w-full h-full object-contain bg-black"
          />

          <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
            <Camera className="inline-block mr-2 h-4 w-4" />
            Frame: {currentFrame} / {totalFrames}
          </div>
        </div>

        {/* Phase Controls */}
        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">
              Currently Annotating: {annotationPhase === 'doctor' ? 'Doctor Gaze' : 'Patient Gaze'}
            </h3>
            <p className="text-sm text-gray-600">
              {annotationPhase === 'doctor' 
                ? 'Hold 1-3 to continuously annotate frames' 
                : 'Hold 4-5 to continuously annotate frames'}
            </p>
          </div>
          <button 
            onClick={() => {
              setAnnotationPhase(phase => phase === 'doctor' ? 'patient' : 'doctor');
              setCurrentFrame(0);
              if (videoRef.current) {
                videoRef.current.currentTime = 0;
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Switch to {annotationPhase === 'doctor' ? 'Patient' : 'Doctor'} Phase
          </button>
        </div>

        {/* Timeline Visualization */}
        {video && (
          <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-xl font-semibold mb-6">Annotation Timeline</h3>
            <TimelineVisualization 
              manualAnnotations={annotations}
              modelData={modelData}
              totalFrames={totalFrames}
            />
          </div>
        )}

        {/* Accuracy Statistics */}
        {modelData && (
          <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-xl font-semibold mb-6">Annotation Accuracy Metrics</h3>
            
            {/* Doctor Metrics */}
            <div className="mb-8">
              <h4 className="text-lg font-medium mb-4 text-gray-800">Doctor Gaze Accuracy</h4>
              <div className="space-y-4">
                {/* Patient Gaze */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Looking at Patient</span>
                    <span className="text-sm font-medium text-gray-700">
                      {(() => {
                        const stats = calculateDetailedAccuracyStats(annotations.doctor, modelData, 'doctor');
                        if (!stats?.patientGaze.total) return '0%';
                        return `${((stats.patientGaze.correct / stats.patientGaze.total) * 100).toFixed(1)}%`;
                      })()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: (() => {
                          const stats = calculateDetailedAccuracyStats(annotations.doctor, modelData, 'doctor');
                          if (!stats?.patientGaze.total) return '0%';
                          return `${(stats.patientGaze.correct / stats.patientGaze.total) * 100}%`;
                        })()
                      }}
                    ></div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {(() => {
                      const stats = calculateDetailedAccuracyStats(annotations.doctor, modelData, 'doctor');
                      if (!stats?.patientGaze.total) return 'No annotations';
                      return `${stats.patientGaze.correct} correct out of ${stats.patientGaze.total} annotations`;
                    })()}
                  </div>
                </div>

                {/* Screen Gaze */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Looking at Screen</span>
                    <span className="text-sm font-medium text-gray-700">
                      {(() => {
                        const stats = calculateDetailedAccuracyStats(annotations.doctor, modelData, 'doctor');
                        if (!stats?.screenGaze.total) return '0%';
                        return `${((stats.screenGaze.correct / stats.screenGaze.total) * 100).toFixed(1)}%`;
                      })()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: (() => {
                          const stats = calculateDetailedAccuracyStats(annotations.doctor, modelData, 'doctor');
                          if (!stats?.screenGaze.total) return '0%';
                          return `${(stats.screenGaze.correct / stats.screenGaze.total) * 100}%`;
                        })()
                      }}
                    ></div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {(() => {
                      const stats = calculateDetailedAccuracyStats(annotations.doctor, modelData, 'doctor');
                      if (!stats?.screenGaze.total) return 'No annotations';
                      return `${stats.screenGaze.correct} correct out of ${stats.screenGaze.total} annotations`;
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Patient Metrics */}
            <div>
              <h4 className="text-lg font-medium mb-4 text-gray-800">Patient Gaze Accuracy</h4>
              <div className="space-y-4">
                {/* Doctor Gaze */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Looking at Doctor</span>
                    <span className="text-sm font-medium text-gray-700">
                      {(() => {
                        const stats = calculateDetailedAccuracyStats(annotations.patient, modelData, 'patient');
                        if (!stats?.doctorGaze.total) return '0%';
                        return `${((stats.doctorGaze.correct / stats.doctorGaze.total) * 100).toFixed(1)}%`;
                      })()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: (() => {
                          const stats = calculateDetailedAccuracyStats(annotations.patient, modelData, 'patient');
                          if (!stats?.doctorGaze.total) return '0%';
                          return `${(stats.doctorGaze.correct / stats.doctorGaze.total) * 100}%`;
                        })()
                      }}
                    ></div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {(() => {
                      const stats = calculateDetailedAccuracyStats(annotations.patient, modelData, 'patient');
                      if (!stats?.doctorGaze.total) return 'No annotations';
                      return `${stats.doctorGaze.correct} correct out of ${stats.doctorGaze.total} annotations`;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoAnnotator;