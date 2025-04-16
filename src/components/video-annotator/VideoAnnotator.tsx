"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Save, Upload } from "lucide-react";
import TimelineVisualization from "../ui/TimelineVisualization";

const VideoAnnotator = () => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [frameInterval, setFrameInterval] = useState(10);
  const [annotationPhase, setAnnotationPhase] = useState("doctor"); // 'doctor' or 'patient'
  const [continuousAnnotationInterval, setContinuousAnnotationInterval] =
    useState(null);
  const [video, setVideo] = useState(null);
  const [videoFileName, setVideoFileName] = useState("");
  const [modelData, setModelData] = useState(null);
  const [annotations, setAnnotations] = useState({
    doctor: {}, // Format: { frameNumber: annotationValue }
    patient: {},
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const lastAnnotationRef = useRef(null);

  // Handle video file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const url = URL.createObjectURL(file);
      setVideo(url);
      setVideoFileName(file.name);

      const videoEl = document.createElement("video");
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
      console.error("Error loading video:", error);
      alert("Error loading video. Please try another file.");
    }
  };

  // Update canvas with current frame
  const updateFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
    }
  }, []);

  // Handle frame navigation
  const navigateFrames = useCallback(
    (amount) => {
      setCurrentFrame((prev) => {
        const next = prev + amount;
        return Math.max(0, Math.min(next, totalFrames));
      });
    },
    [totalFrames]
  );

  // Add single annotation and store as last annotation
  const addAnnotation = useCallback(
    (value) => {
      const annotationType = annotationPhase;
      setAnnotations((prev) => ({
        ...prev,
        [annotationType]: { ...prev[annotationType], [currentFrame]: value },
      }));
      lastAnnotationRef.current = value;
    },
    [annotationPhase, currentFrame]
  );

  // Start continuous annotation with s key
  const startContinuousAnnotation = useCallback(() => {
    if (!lastAnnotationRef.current) return;

    const advanceFrameAndAnnotate = () => {
      // Add annotation to current frame if not already annotated
      if (!annotations[annotationPhase][currentFrame]) {
        addAnnotation(lastAnnotationRef.current);
      }
      navigateFrames(frameInterval);
    };

    // Start interval for continuous advancing and annotation
    const interval = setInterval(advanceFrameAndAnnotate, 50); // Run every 50ms for smooth advancement
    setContinuousAnnotationInterval(interval);

    // Immediately start advancing
    advanceFrameAndAnnotate();
  }, [
    addAnnotation,
    navigateFrames,
    frameInterval,
    annotations,
    annotationPhase,
    currentFrame,
  ]);

  // Stop continuous annotation
  const stopContinuousAnnotation = useCallback(() => {
    if (continuousAnnotationInterval) {
      clearInterval(continuousAnnotationInterval);
      setContinuousAnnotationInterval(null);
    }
  }, [continuousAnnotationInterval]);

  // Handle keyboard controls
  const handleKeyDown = useCallback(
    (event) => {
      if (event.repeat) return; // Prevent multiple keydown events while holding

      if (event.code === "ArrowLeft") {
        navigateFrames(-frameInterval);
      } else if (event.code === "ArrowRight") {
        navigateFrames(frameInterval);
      } else if (event.code === "KeyS") {
        event.preventDefault();
        startContinuousAnnotation();
      }

      // Doctor phase controls
      if (
        annotationPhase === "doctor" &&
        ["Digit1", "Digit2", "Digit3"].includes(event.code)
      ) {
        const value = parseInt(event.code.replace("Digit", ""));
        addAnnotation(value);
        navigateFrames(frameInterval);
      }
      // Patient phase controls
      else if (
        annotationPhase === "patient" &&
        ["Digit4", "Digit5"].includes(event.code)
      ) {
        const value = parseInt(event.code.replace("Digit", ""));
        addAnnotation(value);
        navigateFrames(frameInterval);
      }
    },
    [
      frameInterval,
      navigateFrames,
      annotationPhase,
      addAnnotation,
      startContinuousAnnotation,
    ]
  );

  // Handle key up to stop continuous annotation
  const handleKeyUp = useCallback(
    (event) => {
      if (event.code === "KeyS") {
        stopContinuousAnnotation();
      }
    },
    [stopContinuousAnnotation]
  );

  // Set up keyboard listeners
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
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
      videoRef.current.addEventListener("seeked", updateFrame);
      return () => videoRef.current?.removeEventListener("seeked", updateFrame);
    }
  }, [updateFrame]);

  // Convert annotations to model-compatible format for saving
  const convertAnnotationsToModelFormat = () => {
    // Process doctor gaze annotations
    const doctorPatientGazeRanges = [];
    const doctorScreenGazeRanges = [];
    const doctorElsewhereGazeRanges = [];
    
    // Process patient gaze annotations
    const patientDoctorGazeRanges = [];
    const patientElsewhereGazeRanges = [];
    
    // Temporary arrays to store continuous ranges of frames
    let currentPatientRange = null;
    let currentScreenRange = null;
    let currentDoctorElsewhereRange = null;
    let currentPatientDoctorRange = null;
    let currentPatientElsewhereRange = null;
    
    // Sort frames numerically
    const doctorFrames = Object.keys(annotations.doctor)
      .map(Number)
      .sort((a, b) => a - b);
    
    // Process each doctor frame
    doctorFrames.forEach((frame) => {
      const value = annotations.doctor[frame];
      
      // Process doctor looking at patient (value 1)
      if (value === 1) {
        if (!currentPatientRange) {
          currentPatientRange = { startFrame: frame, endFrame: frame };
        } else if (frame === currentPatientRange.endFrame + 1) {
          // Extend the range if frames are consecutive
          currentPatientRange.endFrame = frame;
        } else {
          // Save the current range and start a new one
          doctorPatientGazeRanges.push(currentPatientRange);
          currentPatientRange = { startFrame: frame, endFrame: frame };
        }
        
        // End other ranges if active
        if (currentScreenRange) {
          doctorScreenGazeRanges.push(currentScreenRange);
          currentScreenRange = null;
        }
        if (currentDoctorElsewhereRange) {
          doctorElsewhereGazeRanges.push(currentDoctorElsewhereRange);
          currentDoctorElsewhereRange = null;
        }
      } 
      // Process doctor looking at screen (value 2)
      else if (value === 2) {
        if (!currentScreenRange) {
          currentScreenRange = { startFrame: frame, endFrame: frame };
        } else if (frame === currentScreenRange.endFrame + 1) {
          // Extend the range if frames are consecutive
          currentScreenRange.endFrame = frame;
        } else {
          // Save the current range and start a new one
          doctorScreenGazeRanges.push(currentScreenRange);
          currentScreenRange = { startFrame: frame, endFrame: frame };
        }
        
        // End other ranges if active
        if (currentPatientRange) {
          doctorPatientGazeRanges.push(currentPatientRange);
          currentPatientRange = null;
        }
        if (currentDoctorElsewhereRange) {
          doctorElsewhereGazeRanges.push(currentDoctorElsewhereRange);
          currentDoctorElsewhereRange = null;
        }
      }
      // Process doctor looking elsewhere (value 3)
      else if (value === 3) {
        if (!currentDoctorElsewhereRange) {
          currentDoctorElsewhereRange = { startFrame: frame, endFrame: frame };
        } else if (frame === currentDoctorElsewhereRange.endFrame + 1) {
          // Extend the range if frames are consecutive
          currentDoctorElsewhereRange.endFrame = frame;
        } else {
          // Save the current range and start a new one
          doctorElsewhereGazeRanges.push(currentDoctorElsewhereRange);
          currentDoctorElsewhereRange = { startFrame: frame, endFrame: frame };
        }
        
        // End other ranges if active
        if (currentPatientRange) {
          doctorPatientGazeRanges.push(currentPatientRange);
          currentPatientRange = null;
        }
        if (currentScreenRange) {
          doctorScreenGazeRanges.push(currentScreenRange);
          currentScreenRange = null;
        }
      }
    });
    
    // Add any remaining doctor ranges
    if (currentPatientRange) doctorPatientGazeRanges.push(currentPatientRange);
    if (currentScreenRange) doctorScreenGazeRanges.push(currentScreenRange);
    if (currentDoctorElsewhereRange) doctorElsewhereGazeRanges.push(currentDoctorElsewhereRange);
    
    // Sort frames numerically for patients
    const patientFrames = Object.keys(annotations.patient)
      .map(Number)
      .sort((a, b) => a - b);
    
    // Process each patient frame
    patientFrames.forEach((frame) => {
      const value = annotations.patient[frame];
      
      // Process patient looking at doctor (value 4)
      if (value === 4) {
        if (!currentPatientDoctorRange) {
          currentPatientDoctorRange = { startFrame: frame, endFrame: frame };
        } else if (frame === currentPatientDoctorRange.endFrame + 1) {
          // Extend the range if frames are consecutive
          currentPatientDoctorRange.endFrame = frame;
        } else {
          // Save the current range and start a new one
          patientDoctorGazeRanges.push(currentPatientDoctorRange);
          currentPatientDoctorRange = { startFrame: frame, endFrame: frame };
        }
        
        // End other ranges if active
        if (currentPatientElsewhereRange) {
          patientElsewhereGazeRanges.push(currentPatientElsewhereRange);
          currentPatientElsewhereRange = null;
        }
      } 
      // Process patient looking elsewhere (value 5)
      else if (value === 5) {
        if (!currentPatientElsewhereRange) {
          currentPatientElsewhereRange = { startFrame: frame, endFrame: frame };
        } else if (frame === currentPatientElsewhereRange.endFrame + 1) {
          // Extend the range if frames are consecutive
          currentPatientElsewhereRange.endFrame = frame;
        } else {
          // Save the current range and start a new one
          patientElsewhereGazeRanges.push(currentPatientElsewhereRange);
          currentPatientElsewhereRange = { startFrame: frame, endFrame: frame };
        }
        
        // End other ranges if active
        if (currentPatientDoctorRange) {
          patientDoctorGazeRanges.push(currentPatientDoctorRange);
          currentPatientDoctorRange = null;
        }
      }
    });
    
    // Add any remaining patient ranges
    if (currentPatientDoctorRange) patientDoctorGazeRanges.push(currentPatientDoctorRange);
    if (currentPatientElsewhereRange) patientElsewhereGazeRanges.push(currentPatientElsewhereRange);
    
    // Format the final output to match the model data structure
    return [
      {
        videoFile: videoFileName,
      },
      {
        manualAnnotations: {
          // Following the naming convention in the model data
          rightPersonGaze: doctorPatientGazeRanges,
          rightPersonScreen: doctorScreenGazeRanges,
          rightPersonElsewhere: doctorElsewhereGazeRanges,
          leftPersonGaze: patientDoctorGazeRanges,
          leftPersonElsewhere: patientElsewhereGazeRanges
        }
      }
    ];
  };

  // Save annotations as JSON
  const saveAnnotations = () => {
    if (!video || (Object.keys(annotations.doctor).length === 0 && Object.keys(annotations.patient).length === 0)) {
      alert("No video or annotations to save.");
      return;
    }
    
    try {
      // Convert annotations to the expected model format
      const annotationsData = convertAnnotationsToModelFormat();
      
      // Create a Blob with the data
      const blob = new Blob([JSON.stringify(annotationsData, null, 2)], { type: "application/json" });
      
      // Create a download link and trigger it
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName = videoFileName ? `${videoFileName.split('.')[0]}_annotations.json` : "annotations.json";
      
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert("Annotations saved successfully!");
    } catch (error) {
      console.error("Error saving annotations:", error);
      alert("Error saving annotations. Please try again.");
    }
  };

  // Load AI model predictions
  const loadModelPredictions = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Set model data for visualization and comparison only
      setModelData(data);
      
      alert("AI model predictions loaded for comparison!");
    } catch (error) {
      console.error("Error loading model predictions:", error);
      alert("Error loading model predictions. Please check the file format and try again.");
    }
    
    // Reset the file input
    event.target.value = null;
  };

  // Load user's previous annotations
  const loadUserAnnotations = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Convert the data to the frame-by-frame annotation format
      const doctorAnnotations = {};
      const patientAnnotations = {};
      
      // Extract data from the loaded file
      const manualAnnotations = data[1]?.manualAnnotations;
      
      if (manualAnnotations) {
        // Process doctor looking at patient ranges
        if (manualAnnotations.rightPersonGaze) {
          manualAnnotations.rightPersonGaze.forEach(range => {
            for (let frame = range.startFrame; frame <= range.endFrame; frame++) {
              doctorAnnotations[frame] = 1; // doctor looking at patient
            }
          });
        }
        
        // Process doctor looking at screen ranges
        if (manualAnnotations.rightPersonScreen) {
          manualAnnotations.rightPersonScreen.forEach(range => {
            for (let frame = range.startFrame; frame <= range.endFrame; frame++) {
              doctorAnnotations[frame] = 2; // doctor looking at screen
            }
          });
        }
        
        // Process doctor looking elsewhere ranges
        if (manualAnnotations.rightPersonElsewhere) {
          manualAnnotations.rightPersonElsewhere.forEach(range => {
            for (let frame = range.startFrame; frame <= range.endFrame; frame++) {
              doctorAnnotations[frame] = 3; // doctor looking elsewhere
            }
          });
        }
        
        // Process patient looking at doctor ranges
        if (manualAnnotations.leftPersonGaze) {
          manualAnnotations.leftPersonGaze.forEach(range => {
            for (let frame = range.startFrame; frame <= range.endFrame; frame++) {
              patientAnnotations[frame] = 4; // patient looking at doctor
            }
          });
        }
        
        // Process patient looking elsewhere ranges
        if (manualAnnotations.leftPersonElsewhere) {
          manualAnnotations.leftPersonElsewhere.forEach(range => {
            for (let frame = range.startFrame; frame <= range.endFrame; frame++) {
              patientAnnotations[frame] = 5; // patient looking elsewhere
            }
          });
        }
      }
      
      // Set the annotations state
      setAnnotations({
        doctor: doctorAnnotations,
        patient: patientAnnotations
      });
      
      alert("Your annotations loaded successfully for editing!");
    } catch (error) {
      console.error("Error loading annotations:", error);
      alert("Error loading annotations. Please check the file format and try again.");
    }
    
    // Reset the file input
    event.target.value = null;
  };

  const calculateDetailedAccuracyStats = (userAnnotations, modelData, type) => {
    if (
      !modelData ||
      !userAnnotations ||
      Object.keys(userAnnotations).length === 0
    ) {
      return null;
    }
  
    const getModelGazeStatus = (frame, gazeRanges) => {
      return gazeRanges.some(
        (range) => frame >= range.startFrame && frame <= range.endFrame
      );
    };
  
    let metrics = {};
  
    if (type === "doctor") {
      // Evaluating doctor gaze annotations
      metrics = {
        patientGaze: { correct: 0, total: 0 },
        screenGaze: { correct: 0, total: 0 },
      };
  
      Object.entries(userAnnotations).forEach(([frame, value]) => {
        const frameNum = parseInt(frame);
  
        // FIXED: Check if doctor is looking at patient in model data
        // Using rightPersonGaze for doctor looking at patient
        const modelPatientGaze = getModelGazeStatus(
          frameNum,
          modelData[1]?.manualAnnotations?.rightPersonGaze || []
        );
  
        // Check if doctor is looking at screen in model data
        const modelScreenGaze = getModelGazeStatus(
          frameNum,
          modelData[1]?.manualAnnotations?.rightPersonScreen || []
        );
  
        // User's annotations
        const userPatientGaze = value === 1; // User says doctor is looking at patient
        const userScreenGaze = value === 2; // User says doctor is looking at screen
  
        // Calculate accuracy for patient gaze
        if (userPatientGaze || modelPatientGaze) {
          metrics.patientGaze.total++;
          if (userPatientGaze === modelPatientGaze) {
            metrics.patientGaze.correct++;
          }
        }
  
        // Calculate accuracy for screen gaze
        if (userScreenGaze || modelScreenGaze) {
          metrics.screenGaze.total++;
          if (userScreenGaze === modelScreenGaze) {
            metrics.screenGaze.correct++;
          }
        }
      });
    } else {
      // Evaluating patient gaze annotations
      metrics = {
        doctorGaze: { correct: 0, total: 0 },
      };
  
      Object.entries(userAnnotations).forEach(([frame, value]) => {
        const frameNum = parseInt(frame);
  
        // FIXED: Check if patient is looking at doctor in model data
        // Using leftPersonGaze for patient looking at doctor
        const modelDoctorGaze = getModelGazeStatus(
          frameNum,
          modelData[1]?.manualAnnotations?.leftPersonGaze || []
        );
  
        // User's annotations
        const userDoctorGaze = value === 4; // User says patient is looking at doctor
  
        // Calculate accuracy for doctor gaze
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
    <div className="w-full max-w-7xl mx-auto bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center py-4 border-b border-gray-200">
        Video Annotation Tool
      </h2>
      <div className="p-4">
        {/* File Upload and Controls */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Upload Video
            </label>
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
            <label className="block text-sm font-medium text-gray-700">
              Upload AI Model Predictions
            </label>
            <div className="flex items-center">
              <input
                type="file"
                accept=".json"
                onChange={loadModelPredictions}
                className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 
                         file:rounded-md file:border-0 file:text-sm file:font-semibold 
                         file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
              <div className="ml-2 text-xs text-gray-500">
                <Upload className="h-4 w-4 inline-block mr-1" /> For comparison only
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Load Your Annotations
            </label>
            <div className="flex items-center">
              <input
                type="file"
                accept=".json"
                onChange={loadUserAnnotations}
                className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 
                         file:rounded-md file:border-0 file:text-sm file:font-semibold 
                         file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
              <div className="ml-2 text-xs text-gray-500">
                <Upload className="h-4 w-4 inline-block mr-1" /> For editing
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Annotate every N frames:
            </label>
            <select
              value={frameInterval}
              onChange={(e) => setFrameInterval(Number(e.target.value))}
              className="block rounded-md border-gray-300 shadow-sm px-4 py-2"
            >
              <option value="1">1 frame</option>
              <option value="5">5 frame</option>
              <option value="10">10 frames</option>
              <option value="20">20 frames</option>
              <option value="50">50 frames</option>
              <option value="200">200 frames</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              &nbsp;
            </label>
            <button
              onClick={saveAnnotations}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center"
              disabled={!video || (Object.keys(annotations.doctor).length === 0 && Object.keys(annotations.patient).length === 0)}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Annotations
            </button>
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              &nbsp;
            </label>
            <button
              onClick={() => {
                setAnnotations({ doctor: {}, patient: {} });
                setAnnotationPhase("doctor");
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

        {/* Phase indicator */}
        <div className="mb-4 px-4 py-2 bg-blue-50 rounded-md border border-blue-200 flex justify-between items-center">
          <div>
            <span className="font-medium">Currently Annotating:</span>{" "}
            {annotationPhase === "doctor" ? "Doctor Gaze" : "Patient Gaze"}
            <span className="ml-2 text-sm text-gray-500">
              (Annotating only the current frame with each key press)
            </span>
          </div>
          <button
            onClick={() => {
              setAnnotationPhase((phase) =>
                phase === "doctor" ? "patient" : "doctor"
              );
              setCurrentFrame(0);
              if (videoRef.current) {
                videoRef.current.currentTime = 0;
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Switch to {annotationPhase === "doctor" ? "Patient" : "Doctor"}{" "}
            Phase
          </button>
        </div>

        {/* Main content area */}
        <div className="flex flex-wrap lg:flex-nowrap gap-4">
          {/* Left column - Controls Legend */}
          <div className="w-full lg:w-1/4 bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-lg mb-4">Keyboard Controls</h3>

            <div className="mb-6">
              <h4 className="font-medium mb-2">Navigation</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <span className="inline-block w-24 px-2 py-1 bg-gray-200 rounded mr-2 text-center">
                    ←
                  </span>
                  <span>Previous Frame</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-block w-24 px-2 py-1 bg-gray-200 rounded mr-2 text-center">
                    →
                  </span>
                  <span>Next Frame</span>
                </li>
              </ul>
            </div>

            <div className="mb-6">
              <h4 className="font-medium mb-2">
                Doctor Annotation (First Phase)
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <span className="inline-block w-24 px-2 py-1 bg-gray-200 rounded mr-2 text-center">
                    1
                  </span>
                  <span>Looking at Patient</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-block w-24 px-2 py-1 bg-gray-200 rounded mr-2 text-center">
                    2
                  </span>
                  <span>Looking at Screen</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-block w-24 px-2 py-1 bg-gray-200 rounded mr-2 text-center">
                    3
                  </span>
                  <span>Looking Elsewhere</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">
                Patient Annotation (Second Phase)
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <span className="inline-block w-24 px-2 py-1 bg-gray-200 rounded mr-2 text-center">
                    4
                  </span>
                  <span>Looking at Doctor</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-block w-24 px-2 py-1 bg-gray-200 rounded mr-2 text-center">
                    5
                  </span>
                  <span>Looking Elsewhere</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Middle column - Video */}
          <div className="w-full lg:w-2/4">
            {/* Video Display */}
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
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

            {/* Annotation Timelines */}
            {video && (
              <div className="w-full mb-6">
                <TimelineVisualization
                  manualAnnotations={annotations}
                  modelData={modelData}
                  totalFrames={totalFrames}
                  annotationPhase={annotationPhase}
                  currentFrame={currentFrame} // Add this prop
                />
              </div>
            )}
          </div>

          {/* Right column - Color Legend */}
          <div className="w-full lg:w-1/4 bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-lg mb-4">Color Legend</h3>

            {/* Doctor Gaze Colors */}
            <div className="mb-6">
              <h4 className="font-medium mb-2">Doctor Gaze Colors</h4>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <span className="inline-block w-6 h-6 rounded bg-red-500 mr-2"></span>
                  <span>Looking at Patient</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-block w-6 h-6 rounded bg-blue-500 mr-2"></span>
                  <span>Looking at Screen</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-block w-6 h-6 rounded bg-gray-400 mr-2"></span>
                  <span>Looking Elsewhere</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Patient Gaze Colors</h4>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <span className="inline-block w-6 h-6 rounded bg-purple-500 mr-2"></span>
                  <span>Looking at Doctor</span>
                </li>
                <li className="flex items-center">
                  <span className="inline-block w-6 h-6 rounded bg-gray-400 mr-2"></span>
                  <span>Looking Elsewhere</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Only show accuracy statistics when model data is available and there are annotations */}
        {modelData &&
          (Object.keys(annotations.doctor).length > 0 ||
            Object.keys(annotations.patient).length > 0) && (
            <div className="mt-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-xl font-semibold mb-4">
                Annotation Accuracy
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Doctor Metrics */}
                <div>
                  <h4 className="text-lg font-medium mb-4 text-gray-800">
                    Doctor Gaze Accuracy
                  </h4>
                  <div className="space-y-4">
                    {/* Patient Gaze */}
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Looking at Patient
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          {(() => {
                            const stats = calculateDetailedAccuracyStats(
                              annotations.doctor,
                              modelData,
                              "doctor"
                            );
                            if (!stats?.patientGaze.total) return "0%";
                            return `${(
                              (stats.patientGaze.correct /
                                stats.patientGaze.total) *
                              100
                            ).toFixed(1)}%`;
                          })()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-red-500 h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: (() => {
                            const stats = calculateDetailedAccuracyStats(
                              annotations.doctor,
                              modelData,
                              "doctor"
                            );
                            if (!stats?.patientGaze.total) return "0%";
                            return `${
                              (stats.patientGaze.correct /
                                stats.patientGaze.total) *
                              100
                            }%`;
                          })(),
                        }}
                      ></div>
                    </div>
                    </div>

                    {/* Screen Gaze */}
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          Looking at Screen
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          {(() => {
                            const stats = calculateDetailedAccuracyStats(
                              annotations.doctor,
                              modelData,
                              "doctor"
                            );
                            if (!stats?.screenGaze.total) return "0%";
                            return `${(
                              (stats.screenGaze.correct /
                                stats.screenGaze.total) *
                              100
                            ).toFixed(1)}%`;
                          })()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                          style={{
                            width: (() => {
                              const stats = calculateDetailedAccuracyStats(
                                annotations.doctor,
                                modelData,
                                "doctor"
                              );
                              if (!stats?.screenGaze.total) return "0%";
                              return `${
                                (stats.screenGaze.correct /
                                  stats.screenGaze.total) *
                                100
                              }%`;
                            })(),
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Patient Metrics */}
                <div>
                  <h4 className="text-lg font-medium mb-4 text-gray-800">
                    Patient Gaze Accuracy
                  </h4>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Looking at Doctor
                      </span>
                      <span className="text-sm font-medium text-gray-700">
                        {(() => {
                          const stats = calculateDetailedAccuracyStats(
                            annotations.patient,
                            modelData,
                            "patient"
                          );
                          if (!stats?.doctorGaze.total) return "0%";
                          return `${(
                            (stats.doctorGaze.correct /
                              stats.doctorGaze.total) *
                            100
                          ).toFixed(1)}%`;
                        })()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: (() => {
                            const stats = calculateDetailedAccuracyStats(
                              annotations.patient,
                              modelData,
                              "patient"
                            );
                            if (!stats?.doctorGaze.total) return "0%";
                            return `${
                              (stats.doctorGaze.correct /
                                stats.doctorGaze.total) *
                              100
                            }%`;
                          })(),
                        }}
                      ></div>
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