"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Camera } from "lucide-react";
import TimelineVisualization from "../ui/TimelineVisualization";

const VideoAnnotator = () => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [frameInterval, setFrameInterval] = useState(10);
  const [annotationPhase, setAnnotationPhase] = useState("doctor"); // 'doctor' or 'patient'
  const [continuousAnnotationInterval, setContinuousAnnotationInterval] =
    useState(null);
  const [video, setVideo] = useState(null);
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

  // Render vertical bars for annotations
  const renderAnnotationBars = () => {
    if (!video || totalFrames === 0) return null;

    const containerWidth = 100; // percentage-based width
    const barWidth = 0.2; // percentage width of each bar

    const doctorBars = Object.entries(annotations.doctor).map(
      ([frame, value]) => {
        const position = (parseInt(frame) / totalFrames) * containerWidth;
        let color;

        switch (value) {
          case 1:
            color = "#16a34a";
            break; // green for looking at patient
          case 2:
            color = "#3b82f6";
            break; // blue for looking at screen
          case 3:
            color = "#9ca3af";
            break; // gray for looking elsewhere
          default:
            color = "#9ca3af";
        }

        return (
          <div
            key={`doctor-${frame}`}
            className="absolute h-full"
            style={{
              left: `${position}%`,
              width: `${barWidth}%`,
              backgroundColor: color,
            }}
          />
        );
      }
    );

    const patientBars = Object.entries(annotations.patient).map(
      ([frame, value]) => {
        const position = (parseInt(frame) / totalFrames) * containerWidth;
        let color;

        switch (value) {
          case 4:
            color = "#a855f7";
            break; // purple for looking at doctor
          case 5:
            color = "#9ca3af";
            break; // gray for looking elsewhere
          default:
            color = "#9ca3af";
        }

        return (
          <div
            key={`patient-${frame}`}
            className="absolute h-full"
            style={{
              left: `${position}%`,
              width: `${barWidth}%`,
              backgroundColor: color,
            }}
          />
        );
      }
    );

    return (
      <div className="w-full mb-4">
        <div className="mb-2">
          <h4 className="text-sm font-medium text-gray-700">
            Doctor Gaze Annotations
          </h4>
          <div className="relative h-4 w-full bg-gray-200 rounded overflow-hidden">
            {doctorBars}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-700">
            Patient Gaze Annotations
          </h4>
          <div className="relative h-4 w-full bg-gray-200 rounded overflow-hidden">
            {patientBars}
          </div>
        </div>
      </div>
    );
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
    <div className="w-full max-w-5xl mx-auto bg-white rounded-lg shadow-lg">
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
              Upload Model Predictions
            </label>
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
                    console.error("Error parsing JSON:", error);
                    alert("Error parsing changes.json file");
                  }
                }
              }}
              className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 
                       file:rounded-md file:border-0 file:text-sm file:font-semibold 
                       file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Frames per Click
            </label>
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
                <li className="flex items-center">
                  <span className="inline-block w-24 px-2 py-1 bg-gray-200 rounded mr-2 text-center">
                    Hold S
                  </span>
                  <span>Continuous annotation</span>
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
                />
              </div>
            )}
          </div>

          {/* Right column - Color Legend */}
          <div className="w-full lg:w-1/4 bg-gray-50 rounded-lg p-4">
            <h3 className="font-bold text-lg mb-4">Color Legend</h3>

            <div className="mb-6">
              <h4 className="font-medium mb-2">Doctor Gaze Colors</h4>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <span className="inline-block w-6 h-6 rounded bg-green-600 mr-2"></span>
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
                          className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
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
