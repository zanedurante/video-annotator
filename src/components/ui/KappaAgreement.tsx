"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, ChevronLeft, ChevronRight, Users, Video, BarChart3, Eye, EyeOff } from "lucide-react";

const KappaAgreementAnalysis = () => {
  const [files, setFiles] = useState([]);
  const [videoData, setVideoData] = useState({});
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [results, setResults] = useState(null);
  const [showTimelines, setShowTimelines] = useState(false);
  const [warningMessage, setWarningMessage] = useState(null);

  // Handle file uploads
  const handleFileUpload = (event) => {
    const uploadedFiles = Array.from(event.target.files);
    
    Promise.all(
      uploadedFiles.map(file => 
        file.text().then(text => ({
          name: file.name,
          data: JSON.parse(text)
        }))
      )
    ).then(parsedFiles => {
      setFiles(parsedFiles);
      organizeByVideo(parsedFiles);
    }).catch(error => {
      console.error("Error parsing files:", error);
      alert("Error parsing one or more files. Please check the file format.");
    });
  };

  // Organize files by video name and annotator
  const organizeByVideo = (files) => {
    const organized = {};
    
    files.forEach(file => {
      const videoFile = file.data[0]?.videoFile || file.data[0]?.videoTitle || "Unknown Video";
      const annotatorName = file.data[0]?.annotatorName || "Unknown Annotator";
      
      // Clean video name (remove file extension)
      const cleanVideoName = videoFile.replace(/\.(mp4|avi|mov|mkv|webm)$/i, '');
      
      if (!organized[cleanVideoName]) {
        organized[cleanVideoName] = {};
      }
      
      if (!organized[cleanVideoName][annotatorName]) {
        organized[cleanVideoName][annotatorName] = [];
      }
      
      organized[cleanVideoName][annotatorName].push(file);
    });
    
    setVideoData(organized);
    setCurrentVideoIndex(0);
    setResults(null);
  };

  // Get list of video names
  const getVideoNames = () => {
    return Object.keys(videoData);
  };

  // Get current video name
  const getCurrentVideoName = () => {
    const videoNames = getVideoNames();
    return videoNames[currentVideoIndex] || "No Video";
  };

  // Get annotators for current video
  const getCurrentAnnotators = () => {
    const currentVideo = getCurrentVideoName();
    return Object.keys(videoData[currentVideo] || {});
  };

  // Get all files for current video (flattened)
  const getCurrentVideoFiles = () => {
    const currentVideo = getCurrentVideoName();
    const videoAnnotators = videoData[currentVideo] || {};
    
    const allFiles = [];
    Object.values(videoAnnotators).forEach(annotatorFiles => {
      allFiles.push(...annotatorFiles);
    });
    
    return allFiles;
  };

  // Get total frames for current video
  const getTotalFrames = () => {
    const currentFiles = getCurrentVideoFiles();
    if (currentFiles.length === 0) return 1000; // Default
    
    // Try to get total frames from video info, or estimate from annotations
    const firstFile = currentFiles[0];
    const videoInfo = firstFile.data[1]?.videoInfo;
    
    if (videoInfo?.totalFrames) {
      return videoInfo.totalFrames;
    }
    
    // Estimate from annotations
    const annotations = firstFile.data[1]?.manualAnnotations;
    if (annotations) {
      let maxFrame = 0;
      ['rightPersonGaze', 'rightPersonScreen', 'rightPersonElsewhere', 
       'leftPersonGaze', 'leftPersonScreen', 'leftPersonElsewhere'].forEach(type => {
        if (annotations[type]) {
          annotations[type].forEach(range => {
            maxFrame = Math.max(maxFrame, range.endFrame);
          });
        }
      });
      return maxFrame > 0 ? maxFrame : 1000;
    }
    
    return 1000; // Default fallback
  };

  // Draw timeline visualization
  const drawTimeline = (canvas, annotationData, type, annotatorName) => {
    if (!canvas || !annotationData) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const totalFrames = getTotalFrames();
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set background
    ctx.fillStyle = '#f3f4f6'; // Light gray
    ctx.fillRect(0, 0, width, height);
    
    const annotations = annotationData[1]?.manualAnnotations;
    if (!annotations) return;
    
    if (type === 'doctor') {
      // Draw doctor annotations
      if (annotations.rightPersonGaze) {
        ctx.fillStyle = '#10b981'; // Green
        annotations.rightPersonGaze.forEach(range => {
          const startX = (range.startFrame / totalFrames) * width;
          const endX = (range.endFrame / totalFrames) * width;
          const barWidth = Math.max(1, endX - startX);
          ctx.fillRect(startX, 0, barWidth, height);
        });
      }
      
      if (annotations.rightPersonScreen) {
        ctx.fillStyle = '#ef4444'; // Red
        annotations.rightPersonScreen.forEach(range => {
          const startX = (range.startFrame / totalFrames) * width;
          const endX = (range.endFrame / totalFrames) * width;
          const barWidth = Math.max(1, endX - startX);
          ctx.fillRect(startX, 0, barWidth, height);
        });
      }
      
      if (annotations.rightPersonElsewhere) {
        ctx.fillStyle = '#6b7280'; // Gray
        annotations.rightPersonElsewhere.forEach(range => {
          const startX = (range.startFrame / totalFrames) * width;
          const endX = (range.endFrame / totalFrames) * width;
          const barWidth = Math.max(1, endX - startX);
          ctx.fillRect(startX, 0, barWidth, height);
        });
      }
    } else {
      // Draw patient annotations
      if (annotations.leftPersonGaze) {
        ctx.fillStyle = '#10b981'; // Green
        annotations.leftPersonGaze.forEach(range => {
          const startX = (range.startFrame / totalFrames) * width;
          const endX = (range.endFrame / totalFrames) * width;
          const barWidth = Math.max(1, endX - startX);
          ctx.fillRect(startX, 0, barWidth, height);
        });
      }
      
      if (annotations.leftPersonScreen) {
        ctx.fillStyle = '#ef4444'; // Red
        annotations.leftPersonScreen.forEach(range => {
          const startX = (range.startFrame / totalFrames) * width;
          const endX = (range.endFrame / totalFrames) * width;
          const barWidth = Math.max(1, endX - startX);
          ctx.fillRect(startX, 0, barWidth, height);
        });
      }
      
      if (annotations.leftPersonElsewhere) {
        ctx.fillStyle = '#6b7280'; // Gray
        annotations.leftPersonElsewhere.forEach(range => {
          const startX = (range.startFrame / totalFrames) * width;
          const endX = (range.endFrame / totalFrames) * width;
          const barWidth = Math.max(1, endX - startX);
          ctx.fillRect(startX, 0, barWidth, height);
        });
      }
    }
  };

  // Timeline component for individual annotator
  const TimelineRow = ({ file, type, annotatorName }) => {
    const canvasRef = useRef(null);
    
    useEffect(() => {
      if (canvasRef.current) {
        drawTimeline(canvasRef.current, file.data, type, annotatorName);
      }
    }, [file, type, annotatorName]);
    
    return (
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{annotatorName}</span>
          <span className="text-xs text-gray-500">
            {type === 'doctor' ? 'Doctor Gaze' : 'Patient Gaze'}
          </span>
        </div>
        <canvas
          ref={canvasRef}
          width={800}
          height={20}
          className="w-full h-5 rounded border border-gray-200"
        />
      </div>
    );
  };

  // Navigation functions
  const goToPreviousVideo = () => {
    const videoNames = getVideoNames();
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
      setResults(null);
    }
  };

  const goToNextVideo = () => {
    const videoNames = getVideoNames();
    if (currentVideoIndex < videoNames.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
      setResults(null);
    }
  };

  // Convert annotation ranges to simple category lists, including "0" annotations
  const convertToSimpleLists = (files) => {
    const doctorLists = [];
    const patientLists = [];
    
    // First pass: collect all frames that ANY annotator has annotated
    const allAnnotatedFrames = new Set();
    
    files.forEach(file => {
      const data = file.data[1]?.manualAnnotations;
      if (!data) return;
      
      // Collect frames from all annotation types for this file
      ['rightPersonGaze', 'rightPersonScreen', 'rightPersonElsewhere', 
       'leftPersonGaze', 'leftPersonScreen', 'leftPersonElsewhere'].forEach(type => {
        if (data[type]) {
          data[type].forEach(range => {
            for (let frame = range.startFrame; frame <= range.endFrame; frame++) {
              allAnnotatedFrames.add(frame);
            }
          });
        }
      });
    });
    
    // Create a master frame list that all annotators will be aligned to
    const masterFrameList = Array.from(allAnnotatedFrames).sort((a, b) => a - b);
    
    // Track frames that are missing annotations from some annotators
    let framesWithMissingAnnotations = 0;
    
    // Second pass: create aligned lists for each annotator
    files.forEach(file => {
      const data = file.data[1]?.manualAnnotations;
      
      // Create doctor category list aligned to master frame list
      const doctorList = [];
      masterFrameList.forEach(frame => {
        if (!data) {
          doctorList.push(0); // No data for this annotator
        } else if (data.rightPersonGaze?.some(range => frame >= range.startFrame && frame <= range.endFrame)) {
          doctorList.push(1); // Looking at patient
        } else if (data.rightPersonScreen?.some(range => frame >= range.startFrame && frame <= range.endFrame)) {
          doctorList.push(2); // Looking at screen
        } else if (data.rightPersonElsewhere?.some(range => frame >= range.startFrame && frame <= range.endFrame)) {
          doctorList.push(3); // Looking elsewhere
        } else {
          doctorList.push(0); // Frame not annotated by this annotator
        }
      });
      
      // Create patient category list aligned to master frame list
      const patientList = [];
      masterFrameList.forEach(frame => {
        if (!data) {
          patientList.push(0); // No data for this annotator
        } else if (data.leftPersonGaze?.some(range => frame >= range.startFrame && frame <= range.endFrame)) {
          patientList.push(1); // Looking at doctor
        } else if (data.leftPersonScreen?.some(range => frame >= range.startFrame && frame <= range.endFrame)) {
          patientList.push(2); // Looking at screen
        } else if (data.leftPersonElsewhere?.some(range => frame >= range.startFrame && frame <= range.endFrame)) {
          patientList.push(3); // Looking elsewhere
        } else {
          patientList.push(0); // Frame not annotated by this annotator
        }
      });
      
      doctorLists.push(doctorList);
      patientLists.push(patientList);
    });
    
    // Count frames that are missing annotations from some annotators
    masterFrameList.forEach(frame => {
      const frameHasMissingAnnotations = files.some(file => {
        const data = file.data[1]?.manualAnnotations;
        if (!data) return true; // This annotator has no data
        
        // Check if this frame is annotated by this annotator
        const isAnnotated = ['rightPersonGaze', 'rightPersonScreen', 'rightPersonElsewhere', 
                            'leftPersonGaze', 'leftPersonScreen', 'leftPersonElsewhere'].some(type => {
          return data[type]?.some(range => frame >= range.startFrame && frame <= range.endFrame);
        });
        
        return !isAnnotated; // Frame is missing if not annotated
      });
      
      if (frameHasMissingAnnotations) {
        framesWithMissingAnnotations++;
      }
    });
    
    return { doctorLists, patientLists, framesWithMissingAnnotations };
  };

  // Calculate Cohen's Kappa for two raters
  const calculateKappa = (list1, list2) => {
    if (list1.length === 0 || list2.length === 0 || list1.length !== list2.length) {
      return { kappa: 0, agreement: 0, total: 0 };
    }

    const n = list1.length;
    let agreements = 0;
    
    // Count agreements
    for (let i = 0; i < n; i++) {
      if (list1[i] === list2[i]) {
        agreements++;
      }
    }
    
    const observedAgreement = agreements / n;
    
    // Calculate expected agreement
    const categories = [...new Set([...list1, ...list2])];
    let expectedAgreement = 0;
    
    categories.forEach(category => {
      const prop1 = list1.filter(x => x === category).length / n;
      const prop2 = list2.filter(x => x === category).length / n;
      expectedAgreement += prop1 * prop2;
    });
    
    const kappa = expectedAgreement === 1 ? 1 : (observedAgreement - expectedAgreement) / (1 - expectedAgreement);
    
    return {
      kappa: isNaN(kappa) ? 0 : kappa,
      agreement: observedAgreement,
      total: n
    };
  };

  // Calculate Fleiss' Kappa for multiple raters
  const calculateFleissKappa = (lists) => {
    if (lists.length < 2) return { kappa: 0, agreement: 0, total: 0 };
    
    // Find common length (minimum length among all lists)
    const minLength = Math.min(...lists.map(list => list.length));
    if (minLength === 0) return { kappa: 0, agreement: 0, total: 0 };
    
    // Truncate all lists to common length
    const truncatedLists = lists.map(list => list.slice(0, minLength));
    
    // Get all unique categories
    const allCategories = [...new Set(truncatedLists.flat())];
    const k = allCategories.length; // number of categories
    const n = minLength; // number of items
    const m = truncatedLists.length; // number of raters
    
    if (k === 0 || m === 0) return { kappa: 0, agreement: 0, total: 0 };
    
    // Calculate agreement for each item
    let totalAgreement = 0;
    for (let i = 0; i < n; i++) {
      const itemRatings = truncatedLists.map(list => list[i]);
      const categoryCounts = {};
      
      // Count ratings for each category for this item
      allCategories.forEach(cat => {
        categoryCounts[cat] = itemRatings.filter(rating => rating === cat).length;
      });
      
      // Calculate agreement for this item
      let itemAgreement = 0;
      Object.values(categoryCounts).forEach(count => {
        itemAgreement += count * (count - 1);
      });
      itemAgreement = itemAgreement / (m * (m - 1));
      totalAgreement += itemAgreement;
    }
    
    const observedAgreement = totalAgreement / n;
    
    // Calculate expected agreement
    const categoryProportions = {};
    allCategories.forEach(cat => {
      categoryProportions[cat] = truncatedLists.flat().filter(rating => rating === cat).length / (n * m);
    });
    
    const expectedAgreement = Object.values(categoryProportions).reduce((sum, prop) => sum + prop * prop, 0);
    
    const kappa = expectedAgreement === 1 ? 1 : (observedAgreement - expectedAgreement) / (1 - expectedAgreement);
    
    return {
      kappa: isNaN(kappa) ? 0 : kappa,
      agreement: observedAgreement,
      total: n
    };
  };

  // Calculate kappa for all combinations
  const calculateAllKappa = () => {
    const currentVideoFiles = getCurrentVideoFiles();
    
    if (currentVideoFiles.length < 2) {
      alert("Need at least 2 annotation files for the current video to calculate agreement.");
      return;
    }

    const { doctorLists, patientLists, framesWithMissingAnnotations } = convertToSimpleLists(currentVideoFiles);

    console.log("=========doctorLists=========");
    console.log(doctorLists);
    console.log("=========patientLists=========");
    console.log(patientLists);
    
    if (doctorLists.length < 2) {
      alert("Need at least 2 valid annotation files to calculate agreement.");
      return;
    }

    // Show warning if there are frames with missing annotations
    if (framesWithMissingAnnotations > 0) {
      setWarningMessage(`Warning: ${framesWithMissingAnnotations} frames were only annotated by one annotator in the given annotation files. To calculate Kappa, the frames were annotated as '0'.`);
    } else {
      setWarningMessage(null);
    }

    const annotatorNames = getCurrentAnnotators();
    const pairwiseResults = [];
    
    // Calculate pairwise Cohen's Kappa
    for (let i = 0; i < doctorLists.length; i++) {
      for (let j = i + 1; j < doctorLists.length; j++) {
        const annotator1 = currentVideoFiles[i].data[0]?.annotatorName || `Annotator ${i + 1}`;
        const annotator2 = currentVideoFiles[j].data[0]?.annotatorName || `Annotator ${j + 1}`;

        const doctorKappa = calculateKappa(doctorLists[i], doctorLists[j]);
        const patientKappa = calculateKappa(patientLists[i], patientLists[j]);
        
        pairwiseResults.push({
          pair: `${annotator1} vs ${annotator2}`,
          doctor: doctorKappa,
          patient: patientKappa
        });
      }
    }
    
    // Calculate overall Fleiss' Kappa if more than 2 raters
    const overallResults = {
      doctor: calculateFleissKappa(doctorLists),
      patient: calculateFleissKappa(patientLists)
    };
    
    setResults({
      pairwise: pairwiseResults,
      overall: overallResults,
      videoName: getCurrentVideoName(),
      annotators: annotatorNames,
      fileCount: currentVideoFiles.length
    });
  };

  // Interpretation function - Updated to show full -1 to 1 range
  const interpretKappa = (kappa) => {
    if (kappa < -0.20) return { text: "Strong Disagreement", color: "text-red-700" };
    if (kappa < 0) return { text: "Disagreement (worse than chance)", color: "text-red-600" };
    if (kappa === 0) return { text: "Random Chance Agreement", color: "text-gray-600" };
    if (kappa < 0.20) return { text: "Slight Agreement", color: "text-yellow-600" };
    if (kappa < 0.40) return { text: "Fair Agreement", color: "text-yellow-500" };
    if (kappa < 0.60) return { text: "Moderate Agreement", color: "text-blue-500" };
    if (kappa < 0.80) return { text: "Substantial Agreement", color: "text-green-500" };
    return { text: "Almost Perfect Agreement", color: "text-green-600" };
  };

  const videoNames = getVideoNames();
  const currentVideoName = getCurrentVideoName();
  const currentAnnotators = getCurrentAnnotators();

  return (
    <div className="w-full max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-center mb-6 border-b border-gray-200 pb-4">
        Multi-Video Kappa Agreement Analysis
      </h2>

      {/* Warning Popup */}
      {warningMessage && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 font-medium">
                {warningMessage}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  type="button"
                  onClick={() => setWarningMessage(null)}
                  className="inline-flex bg-yellow-50 rounded-md p-1.5 text-yellow-500 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-yellow-50 focus:ring-yellow-600"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload Multiple Annotation Files (JSON)
        </label>
        <input
          type="file"
          accept=".json"
          multiple
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 
                   file:rounded-md file:border-0 file:text-sm file:font-semibold 
                   file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <p className="text-xs text-gray-500 mt-1">
          Upload JSON annotation files from multiple annotators and videos
        </p>
      </div>

      {/* Video Navigation */}
      {videoNames.length > 0 && (
        <div className="mb-6 bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPreviousVideo}
              disabled={currentVideoIndex === 0}
              className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </button>

            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Video className="h-5 w-5 mr-2 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-800">
                  {currentVideoName}
                </h3>
              </div>
              <p className="text-sm text-gray-600">
                Video {currentVideoIndex + 1} of {videoNames.length}
              </p>
            </div>

            <button
              onClick={goToNextVideo}
              disabled={currentVideoIndex === videoNames.length - 1}
              className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>

          {/* Current Video Info */}
          <div className="bg-white rounded-md p-3 border">
            <div className="flex items-center mb-2">
              <Users className="h-4 w-4 mr-2 text-green-600" />
              <span className="font-medium text-gray-700">
                Annotators ({currentAnnotators.length}):
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentAnnotators.map((annotator, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                >
                  {annotator}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {getCurrentVideoFiles().length} annotation files for this video
            </p>
          </div>

          {/* Calculate Button */}
          <button
            onClick={calculateAllKappa}
            disabled={getCurrentVideoFiles().length < 2}
            className="w-full mt-4 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Calculate Kappa Agreement for {currentVideoName}
          </button>

          {/* Timeline Toggle */}
          {getCurrentVideoFiles().length > 0 && (
            <button
              onClick={() => setShowTimelines(!showTimelines)}
              className="w-full mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center justify-center"
            >
              {showTimelines ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide Timeline Visualization
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show Timeline Visualization
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Timeline Visualization */}
      {showTimelines && getCurrentVideoFiles().length > 0 && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-800">
                Timeline Visualization: {getCurrentVideoName()}
              </h3>
            </div>
            <div className="text-sm text-gray-500">
              Total Frames: {getTotalFrames()}
            </div>
          </div>

          {/* Color Legend */}
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Color Legend:</h4>
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center">
                <span className="w-4 h-4 bg-green-500 rounded mr-1"></span>
                <span>Looking at Patient/Doctor</span>
              </div>
              <div className="flex items-center">
                <span className="w-4 h-4 bg-red-500 rounded mr-1"></span>
                <span>Looking at Screen</span>
              </div>
              <div className="flex items-center">
                <span className="w-4 h-4 bg-gray-500 rounded mr-1"></span>
                <span>Looking Elsewhere</span>
              </div>
              <div className="flex items-center">
                <span className="w-4 h-4 bg-gray-300 rounded mr-1"></span>
                <span>No Annotation</span>
              </div>
            </div>
          </div>

          {/* Doctor Gaze Timelines */}
          <div className="mb-6">
            <h4 className="text-md font-semibold text-blue-800 mb-3 border-b border-blue-200 pb-1">
              Doctor Gaze Annotations
            </h4>
            <div className="space-y-2">
              {getCurrentVideoFiles().map((file, index) => {
                const annotatorName = file.data[0]?.annotatorName || `Annotator ${index + 1}`;
                return (
                  <TimelineRow
                    key={`doctor-${index}`}
                    file={file}
                    type="doctor"
                    annotatorName={annotatorName}
                  />
                );
              })}
            </div>
          </div>

          {/* Patient Gaze Timelines */}
          <div>
            <h4 className="text-md font-semibold text-green-800 mb-3 border-b border-green-200 pb-1">
              Patient Gaze Annotations
            </h4>
            <div className="space-y-2">
              {getCurrentVideoFiles().map((file, index) => {
                const annotatorName = file.data[0]?.annotatorName || `Annotator ${index + 1}`;
                return (
                  <TimelineRow
                    key={`patient-${index}`}
                    file={file}
                    type="patient"
                    annotatorName={annotatorName}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="space-y-6">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              Results for: {results.videoName}
            </h3>
            <p className="text-sm text-blue-700">
              {results.fileCount} annotation files from {results.annotators.length} annotators
            </p>
          </div>

          {/* Overall Kappa (Fleiss') */}
          {results.fileCount > 2 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-lg font-semibold mb-4 text-gray-800">
                Overall Agreement (Fleiss' Kappa)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="font-medium text-gray-700 mb-2">Doctor Gaze</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Kappa:</span>
                      <span className={`font-medium ${interpretKappa(results.overall.doctor.kappa).color}`}>
                        {results.overall.doctor.kappa.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Interpretation:</span>
                      <span className={`text-sm ${interpretKappa(results.overall.doctor.kappa).color}`}>
                        {interpretKappa(results.overall.doctor.kappa).text}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Observed Agreement:</span>
                      <span>{(results.overall.doctor.agreement * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Total Comparisons:</span>
                      <span>{results.overall.doctor.total}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h5 className="font-medium text-gray-700 mb-2">Patient Gaze</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Kappa:</span>
                      <span className={`font-medium ${interpretKappa(results.overall.patient.kappa).color}`}>
                        {results.overall.patient.kappa.toFixed(3)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Interpretation:</span>
                      <span className={`text-sm ${interpretKappa(results.overall.patient.kappa).color}`}>
                        {interpretKappa(results.overall.patient.kappa).text}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Observed Agreement:</span>
                      <span>{(results.overall.patient.agreement * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Total Comparisons:</span>
                      <span>{results.overall.patient.total}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pairwise Results */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-lg font-semibold mb-4 text-gray-800">
              Pairwise Agreement (Cohen's Kappa)
            </h4>
            
            <div className="space-y-4">
              {results.pairwise.map((pair, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium text-gray-700 mb-3">{pair.pair}</h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <h6 className="font-medium text-blue-800 mb-2">Doctor Gaze</h6>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Kappa:</span>
                          <span className={`font-medium ${interpretKappa(pair.doctor.kappa).color}`}>
                            {pair.doctor.kappa.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Agreement:</span>
                          <span>{(pair.doctor.agreement * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span>{pair.doctor.total}</span>
                        </div>
                        <div className={`text-xs ${interpretKappa(pair.doctor.kappa).color}`}>
                          {interpretKappa(pair.doctor.kappa).text}
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-3">
                      <h6 className="font-medium text-green-800 mb-2">Patient Gaze</h6>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Kappa:</span>
                          <span className={`font-medium ${interpretKappa(pair.patient.kappa).color}`}>
                            {pair.patient.kappa.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Agreement:</span>
                          <span>{(pair.patient.agreement * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total:</span>
                          <span>{pair.patient.total}</span>
                        </div>
                        <div className={`text-xs ${interpretKappa(pair.patient.kappa).color}`}>
                          {interpretKappa(pair.patient.kappa).text}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kappa Interpretation Guide */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="font-medium text-gray-700 mb-3">Kappa Interpretation Guide (-1 to +1 scale)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-red-700 rounded mr-2"></span>
                <span>&lt; -0.20: Strong Disagreement</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-red-600 rounded mr-2"></span>
                <span>-0.20 to 0.00: Disagreement</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-gray-600 rounded mr-2"></span>
                <span>0.00: Random Chance</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-yellow-600 rounded mr-2"></span>
                <span>0.00-0.20: Slight Agreement</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-yellow-500 rounded mr-2"></span>
                <span>0.21-0.40: Fair Agreement</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded mr-2"></span>
                <span>0.41-0.60: Moderate Agreement</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded mr-2"></span>
                <span>0.61-0.80: Substantial Agreement</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-green-600 rounded mr-2"></span>
                <span>0.81-1.00: Almost Perfect</span>
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs text-blue-700">
                <strong>Note:</strong> Kappa ranges from -1 (perfect disagreement) to +1 (perfect agreement). 
                0 represents agreement expected by random chance. Negative values indicate systematic disagreement.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      {files.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg mb-2">Upload annotation files to get started</p>
          <p className="text-sm">
            Upload multiple JSON annotation files from different annotators and videos to calculate inter-rater agreement.
          </p>
        </div>
      )}
    </div>
  );
};

export default KappaAgreementAnalysis;