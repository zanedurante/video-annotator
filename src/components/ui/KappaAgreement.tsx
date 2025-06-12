"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, BarChart3, Trash2, RefreshCw, AlertTriangle } from "lucide-react";

const KappaAgreement = () => {
  const [annotationFiles, setAnnotationFiles] = useState([]);
  const [videoInfo, setVideoInfo] = useState(null);
  const [kappaResults, setKappaResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [frameIntervalError, setFrameIntervalError] = useState(null);
  
  // References to canvas elements
  const doctorCanvasRefs = useRef({});
  const patientCanvasRefs = useRef({});
  
  // Helper function to detect frame interval from annotations
  const detectFrameInterval = (annotations) => {
    if (!annotations || typeof annotations !== 'object' || Object.keys(annotations).length === 0) {
      return null;
    }
    
    // Get all annotated frames and sort them
    const frames = Object.keys(annotations).map(f => parseInt(f)).sort((a, b) => a - b);
    
    if (frames.length < 2) {
      return null; // Cannot determine interval with less than 2 frames
    }
    
    // Calculate intervals between consecutive frames
    const intervals = [];
    for (let i = 1; i < frames.length; i++) {
      intervals.push(frames[i] - frames[i-1]);
    }
    
    // Find the most common interval (mode)
    const intervalCounts = {};
    intervals.forEach(interval => {
      intervalCounts[interval] = (intervalCounts[interval] || 0) + 1;
    });
    
    // Get the most frequent interval
    const mostCommonInterval = Object.keys(intervalCounts).reduce((a, b) => 
      intervalCounts[a] > intervalCounts[b] ? a : b
    );
    
    return parseInt(mostCommonInterval);
  };
  
  // Helper function to validate frame intervals across files
  const validateFrameIntervals = (files) => {
    const frameIntervals = [];
    
    files.forEach(file => {
      const data = file.data[1]?.manualAnnotations;
      if (!data) return;
      
      // Check intervals for all annotation types
      const allAnnotations = {};
      
      // Combine all doctor annotations
      ['rightPersonGaze', 'rightPersonScreen', 'rightPersonElsewhere'].forEach(type => {
        if (data[type]) {
          data[type].forEach(range => {
            for (let frame = range.startFrame; frame <= range.endFrame; frame++) {
              allAnnotations[frame] = true;
            }
          });
        }
      });
      
      // Combine all patient annotations
      ['leftPersonGaze', 'leftPersonScreen', 'leftPersonElsewhere'].forEach(type => {
        if (data[type]) {
          data[type].forEach(range => {
            for (let frame = range.startFrame; frame <= range.endFrame; frame++) {
              allAnnotations[frame] = true;
            }
          });
        }
      });
      
      const interval = detectFrameInterval(allAnnotations);
      if (interval !== null) {
        frameIntervals.push({
          fileName: file.name,
          interval: interval
        });
      }
    });
    
    // Check if all intervals are the same
    if (frameIntervals.length === 0) {
      return { valid: false, error: "No frame intervals could be detected from the uploaded files." };
    }
    
    const firstInterval = frameIntervals[0].interval;
    const mismatchedFiles = frameIntervals.filter(file => file.interval !== firstInterval);
    
    if (mismatchedFiles.length > 0) {
      return {
        valid: false,
        error: `Frame interval mismatch detected! Expected interval: ${firstInterval} frames, but found different intervals in: ${mismatchedFiles.map(f => `${f.fileName} (${f.interval} frames)`).join(', ')}`
      };
    }
    
    return {
      valid: true,
      interval: firstInterval
    };
  };
  
  // Add annotation file to state
  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setLoading(true);
    setFrameIntervalError(null);
    
    try {
      // Process each file
      const newAnnotationFiles = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Extract video info if not already set
        if (!videoInfo && data.length >= 2 && data[1]?.videoInfo) {
          setVideoInfo(data[1].videoInfo);
        }
        
        newAnnotationFiles.push({
          id: Date.now() + i, // Unique ID
          name: file.name,
          data: data
        });
      }
      
      // Validate frame intervals for all files (existing + new)
      const allFiles = [...annotationFiles, ...newAnnotationFiles];
      
      // Check for exactly 3 files
      if (allFiles.length > 3) {
        alert("Error: Maximum of 3 annotation files allowed for Fleiss's kappa calculation.");
        return;
      }
      
      const validation = validateFrameIntervals(allFiles);
      
      if (!validation.valid) {
        setFrameIntervalError(validation.error);
        alert(`Error: ${validation.error}\n\nPlease ensure all annotation files use the same frame interval setting.`);
        return;
      }
      
      // If validation passes, add the files
      setAnnotationFiles(allFiles);
      
      // Calculate kappa if we have exactly 3 files
      if (allFiles.length === 3) {
        calculateKappa(allFiles);
      }
    } catch (error) {
      console.error("Error loading annotation files:", error);
      alert("Error loading annotation files. Please check the file format and try again.");
    } finally {
      setLoading(false);
      event.target.value = null; // Reset file input
    }
  };
  
  // Remove a file from the list
  const removeFile = (id) => {
    setAnnotationFiles(prev => {
      const updated = prev.filter(file => file.id !== id);
      
      // Clear frame interval error when files are removed
      setFrameIntervalError(null);
      
      // Recalculate kappa if we have exactly 3 files
      if (updated.length === 3) {
        calculateKappa(updated);
      } else {
        setKappaResults(null);
      }
      
      return updated;
    });
  };
  
  // Convert annotation ranges to simple category lists
  const convertToSimpleLists = (files) => {
    const doctorLists = [];
    const patientLists = [];
    
    files.forEach(file => {
      const data = file.data[1]?.manualAnnotations;
      if (!data) {
        doctorLists.push([]);
        patientLists.push([]);
        return;
      }
      
      // Get all annotated frames and sort them
      const allFrames = new Set();
      
      // Collect frames from all annotation types
      ['rightPersonGaze', 'rightPersonScreen', 'rightPersonElsewhere', 
       'leftPersonGaze', 'leftPersonScreen', 'leftPersonElsewhere'].forEach(type => {
        if (data[type]) {
          data[type].forEach(range => {
            for (let frame = range.startFrame; frame <= range.endFrame; frame++) {
              allFrames.add(frame);
            }
          });
        }
      });
      
      const sortedFrames = Array.from(allFrames).sort((a, b) => a - b);
      
      // Create doctor category list
      const doctorList = [];
      sortedFrames.forEach(frame => {
        // Check which doctor category this frame belongs to
        if (data.rightPersonGaze?.some(range => frame >= range.startFrame && frame <= range.endFrame)) {
          doctorList.push(1); // Looking at patient
        } else if (data.rightPersonScreen?.some(range => frame >= range.startFrame && frame <= range.endFrame)) {
          doctorList.push(2); // Looking at screen
        } else if (data.rightPersonElsewhere?.some(range => frame >= range.startFrame && frame <= range.endFrame)) {
          doctorList.push(3); // Looking elsewhere
        }
      });
      
      // Create patient category list
      const patientList = [];
      sortedFrames.forEach(frame => {
        // Check which patient category this frame belongs to
        if (data.leftPersonGaze?.some(range => frame >= range.startFrame && frame <= range.endFrame)) {
          patientList.push(1); // Looking at doctor
        } else if (data.leftPersonScreen?.some(range => frame >= range.startFrame && frame <= range.endFrame)) {
          patientList.push(2); // Looking at screen
        } else if (data.leftPersonElsewhere?.some(range => frame >= range.startFrame && frame <= range.endFrame)) {
          patientList.push(3); // Looking elsewhere
        }
      });
      
      doctorLists.push(doctorList);
      patientLists.push(patientList);
    });
    
    return { doctorLists, patientLists };
  };

  // Calculate Fleiss's kappa for multiple raters (exact implementation from Python)
  const calculateFleissKappa = (ratingLists, numCategories = 3) => {
    if (ratingLists.length !== 3) {
      console.log("Fleiss's kappa requires exactly 3 raters");
      return 0;
    }
    
    // Find the minimum length across all lists (only use overlapping items)
    const minLength = Math.min(...ratingLists.map(list => list.length));
    
    if (minLength === 0) {
      console.log("No overlapping ratings found");
      return 0;
    }
    
    // Create ratings array: each item is [rater1_rating, rater2_rating, rater3_rating]
    const ratings = [];
    for (let i = 0; i < minLength; i++) {
      const itemRatings = [ratingLists[0][i], ratingLists[1][i], ratingLists[2][i]];
      // Only include items where all raters provided ratings
      if (itemRatings.every(rating => rating !== undefined && rating !== null)) {
        ratings.push(itemRatings);
      }
    }
    
    console.log(`Fleiss kappa: Processing ${ratings.length} items with 3 raters each`);
    console.log("Sample ratings:", ratings.slice(0, 10));
    
    if (ratings.length === 0) {
      console.log("No valid ratings found for Fleiss kappa");
      return 0;
    }
    
    const N = ratings.length; // number of items
    const n = 3; // number of raters per item
    
    // Step 1: Create a count matrix (N x k) for how many times each category was assigned
    const countMatrix = [];
    for (const item of ratings) {
      const counts = Array(numCategories).fill(0);
      for (const r of item) {
        if (r >= 1 && r <= numCategories) {
          counts[r - 1] += 1; // Convert 1-indexed to 0-indexed
        }
      }
      countMatrix.push(counts);
    }
    
    console.log("Count matrix (first 5 items):", countMatrix.slice(0, 5));
    
    // Step 2: Compute P_bar (mean of individual agreement scores)
    let P_total = 0;
    for (const counts of countMatrix) {
      const itemTotal = counts.reduce((sum, c) => sum + c * (c - 1), 0);
      const P_i = itemTotal / (n * (n - 1));
      P_total += P_i;
    }
    const P_bar = P_total / N;
    
    console.log(`P_bar (observed agreement): ${P_bar.toFixed(4)}`);
    
    // Step 3: Compute P_e_bar (expected agreement by chance)
    const categoryTotals = Array(numCategories).fill(0);
    for (const counts of countMatrix) {
      for (let j = 0; j < numCategories; j++) {
        categoryTotals[j] += counts[j];
      }
    }
    
    const p_j = categoryTotals.map(total => total / (N * n));
    const P_e_bar = p_j.reduce((sum, p) => sum + p * p, 0);
    
    console.log("Category totals:", categoryTotals);
    console.log("Category proportions:", p_j.map(p => p.toFixed(4)));
    console.log(`P_e_bar (expected agreement): ${P_e_bar.toFixed(4)}`);
    
    // Step 4: Compute Fleiss's kappa
    const kappa = (1 - P_e_bar) !== 0 ? (P_bar - P_e_bar) / (1 - P_e_bar) : 1.0;
    
    console.log(`Fleiss kappa: (${P_bar.toFixed(4)} - ${P_e_bar.toFixed(4)}) / (1 - ${P_e_bar.toFixed(4)}) = ${kappa.toFixed(4)}`);
    
    return kappa;
  };

  // Calculate Cohen's kappa for two raters
  const calculateCohenKappaPairwise = (list1, list2, numCategories = 3) => {
    const minLength = Math.min(list1.length, list2.length);
    
    console.log(`Calculating pairwise kappa for lists of length ${list1.length} and ${list2.length}`);
    console.log("List 1:", list1.slice(0, 20)); // Show first 20 items
    console.log("List 2:", list2.slice(0, 20)); // Show first 20 items
    
    if (minLength === 0) {
      console.log("One or both lists are empty, returning 0");
      return 0;
    }
    
    // Only use overlapping annotations - but don't require both to be truthy
    const pairs = [];
    for (let i = 0; i < minLength; i++) {
      // Include all pairs where both raters made a rating (even if different)
      if (list1[i] !== undefined && list2[i] !== undefined && list1[i] !== null && list2[i] !== null) {
        pairs.push([list1[i], list2[i]]);
      }
    }
    
    console.log(`Found ${pairs.length} valid pairs out of ${minLength} possible`);
    console.log("First 10 pairs:", pairs.slice(0, 10));
    
    if (pairs.length === 0) {
      console.log("No valid pairs found, returning 0");
      return 0;
    }
    
    // Calculate observed agreement
    const agreements = pairs.filter(([a, b]) => a === b).length;
    const Po = agreements / pairs.length;
    
    console.log(`Agreements: ${agreements} out of ${pairs.length} pairs = ${Po.toFixed(3)}`);
    
    // Calculate expected agreement
    const counts1 = Array(numCategories + 1).fill(0);
    const counts2 = Array(numCategories + 1).fill(0);
    
    pairs.forEach(([a, b]) => {
      counts1[a]++;
      counts2[b]++;
    });
    
    console.log("Counts for rater 1:", counts1);
    console.log("Counts for rater 2:", counts2);
    
    let Pe = 0;
    for (let cat = 1; cat <= numCategories; cat++) {
      const p1 = counts1[cat] / pairs.length;
      const p2 = counts2[cat] / pairs.length;
      Pe += p1 * p2;
    }
    
    console.log(`Expected agreement (Pe): ${Pe.toFixed(3)}`);
    
    if (Pe >= 1) {
      const result = Po >= 1 ? 1 : 0;
      console.log(`Pe >= 1, returning: ${result}`);
      return result;
    }
    
    const kappa = (Po - Pe) / (1 - Pe);
    console.log(`Final kappa: (${Po.toFixed(3)} - ${Pe.toFixed(3)}) / (1 - ${Pe.toFixed(3)}) = ${kappa.toFixed(3)}`);
    
    return kappa;
  };

  // Calculate kappa agreement
  const calculateKappa = (files) => {
    if (!files || files.length !== 3) {
      setKappaResults(null);
      return;
    }
    
    setLoading(true);
    
    try {
      // Convert files to simple category lists
      const { doctorLists, patientLists } = convertToSimpleLists(files);
      
      // Debug: Output lists to console
      console.log("=== DEBUGGING CATEGORY LISTS ===");
      console.log("Doctor Lists:");
      doctorLists.forEach((list, index) => {
        console.log(`  File ${index + 1} (${files[index].name}):`, list);
      });
      console.log("Patient Lists:");
      patientLists.forEach((list, index) => {
        console.log(`  File ${index + 1} (${files[index].name}):`, list);
      });
      console.log("================================");
      
      // Calculate Fleiss's kappa for doctor and patient annotations
      const doctorFleissKappa = calculateFleissKappa(doctorLists);
      const patientFleissKappa = calculateFleissKappa(patientLists);
      
      // Calculate pairwise Cohen's kappa for all combinations
      const doctorPairwise = [];
      const patientPairwise = [];
      
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          const doctorKappa = calculateCohenKappaPairwise(doctorLists[i], doctorLists[j]);
          const patientKappa = calculateCohenKappaPairwise(patientLists[i], patientLists[j]);
          
          doctorPairwise.push({
            file1: files[i].name,
            file2: files[j].name,
            kappa: doctorKappa
          });
          
          patientPairwise.push({
            file1: files[i].name,
            file2: files[j].name,
            kappa: patientKappa
          });
        }
      }
      
      const results = {
        doctor: {
          fleissKappa: doctorFleissKappa,
          pairwise: doctorPairwise
        },
        patient: {
          fleissKappa: patientFleissKappa,
          pairwise: patientPairwise
        }
      };
      
      setKappaResults(results);
    } catch (error) {
      console.error("Error calculating kappa:", error);
      alert("Error calculating kappa agreement. Please check the files and try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Draw timelines for visualization
  const drawAnnotationTimelines = () => {
    if (annotationFiles.length === 0) return;
    
    // Get total frames from first file or use default
    const totalFrames = annotationFiles[0]?.data[1]?.videoInfo?.totalFrames || 1000;
    
    // Categories for doctor and patient
    const doctorCategories = ["rightPersonGaze", "rightPersonScreen", "rightPersonElsewhere"];
    const patientCategories = ["leftPersonGaze", "leftPersonScreen", "leftPersonElsewhere"];
    
    // Draw timelines for each file
    annotationFiles.forEach((file, fileIndex) => {
      const doctorCanvas = doctorCanvasRefs.current[file.id];
      const patientCanvas = patientCanvasRefs.current[file.id];
      
      if (!doctorCanvas || !patientCanvas) return;
      
      // Get annotation data
      const data = file.data[1]?.manualAnnotations;
      if (!data) return;
      
      // Setup canvas contexts
      const doctorCtx = doctorCanvas.getContext('2d');
      const patientCtx = patientCanvas.getContext('2d');
      
      // Canvas dimensions
      const width = doctorCanvas.width;
      const height = doctorCanvas.height;
      
      // Clear canvases
      doctorCtx.clearRect(0, 0, width, height);
      patientCtx.clearRect(0, 0, width, height);
      
      // Set background
      doctorCtx.fillStyle = '#e5e7eb'; // Light gray
      patientCtx.fillStyle = '#e5e7eb';
      doctorCtx.fillRect(0, 0, width, height);
      patientCtx.fillRect(0, 0, width, height);
      
      // Draw doctor timeline
      doctorCategories.forEach((category, categoryIndex) => {
        const ranges = data[category] || [];
        
        switch(categoryIndex) {
          case 0: doctorCtx.fillStyle = '#1bd018'; break; // Blue for looking at patient
          case 1: doctorCtx.fillStyle = '#ef4444'; break; // Red for looking at screen
          case 2: doctorCtx.fillStyle = '#9ca3af'; break; // Gray for looking elsewhere
        }
        
        ranges.forEach(range => {
          const startX = Math.floor((range.startFrame / totalFrames) * width);
          const endX = Math.floor((range.endFrame / totalFrames) * width);
          const barWidth = Math.max(1, endX - startX);
          
          doctorCtx.fillRect(startX, 0, barWidth, height);
        });
      });
      
      // Draw patient timeline
      patientCategories.forEach((category, categoryIndex) => {
        const ranges = data[category] || [];
        
        switch(categoryIndex) {
          case 0: patientCtx.fillStyle = '#1bd018'; break; // Green for looking at doctor
          case 1: patientCtx.fillStyle = '#ef4444'; break; // Red for looking at screen
          case 2: patientCtx.fillStyle = '#9ca3af'; break; // Gray for looking elsewhere
        }
        
        ranges.forEach(range => {
          const startX = Math.floor((range.startFrame / totalFrames) * width);
          const endX = Math.floor((range.endFrame / totalFrames) * width);
          const barWidth = Math.max(1, endX - startX);
          
          patientCtx.fillRect(startX, 0, barWidth, height);
        });
      });
    });
  };
  
  // Draw timelines when files change
  useEffect(() => {
    if (annotationFiles.length > 0) {
      // Allow time for canvas refs to be created
      setTimeout(drawAnnotationTimelines, 100);
    }
  }, [annotationFiles]);
  
  // Format kappa value for display
  const formatKappa = (kappa) => {
    if (kappa === undefined || kappa === null || isNaN(kappa)) return "N/A";
    
    // Round to 2 decimal places
    const value = Math.round(kappa * 100) / 100;
    
    // Add interpretation
    let interpretation = "";
    if (value <= 0) interpretation = "Poor";
    else if (value <= 0.20) interpretation = "Slight";
    else if (value <= 0.40) interpretation = "Fair";
    else if (value <= 0.60) interpretation = "Moderate";
    else if (value <= 0.80) interpretation = "Substantial";
    else interpretation = "Almost Perfect";
    
    return `${value} (${interpretation})`;
  };
  
  // Get background color based on kappa value
  const getKappaColor = (kappa) => {
    if (kappa === undefined || kappa === null || isNaN(kappa)) return "bg-gray-100";
    
    if (kappa <= 0) return "bg-red-100";
    else if (kappa <= 0.20) return "bg-red-50";
    else if (kappa <= 0.40) return "bg-yellow-50";
    else if (kappa <= 0.60) return "bg-yellow-100";
    else if (kappa <= 0.80) return "bg-green-100";
    else return "bg-green-200";
  };
  
  return (
    <div className="w-full max-w-7xl mx-auto bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-center py-4 border-b border-gray-200">
        Kappa Agreement Analysis
      </h2>
      
      <div className="p-4">
        {/* Frame Interval Error Alert */}
        {frameIntervalError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800 mb-1">Frame Interval Mismatch</h3>
                <p className="text-sm text-red-700">{frameIntervalError}</p>
                <p className="text-xs text-red-600 mt-2">
                  All annotation files must use the same frame interval setting from the annotation tool. 
                  Please re-annotate with consistent settings or upload files with matching intervals.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* File Upload Section */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Upload Annotation Files
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                multiple
                className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 
                         file:rounded-md file:border-0 file:text-sm file:font-semibold 
                         file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <div className="text-xs text-gray-500 mt-1">
                Upload exactly 3 annotation files for Fleiss's kappa analysis. Files must share the same video and frame interval.
              </div>
            </div>
            
            {annotationFiles.length >= 3 && !frameIntervalError && (
              <button
                onClick={() => calculateKappa(annotationFiles)}
                disabled={loading || annotationFiles.length !== 3}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center disabled:bg-gray-400"
              >
                {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                Calculate Fleiss's Kappa
              </button>
            )}
          </div>
        </div>
        
        {/* File List */}
        {annotationFiles.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Uploaded Files</h3>
            <div className="space-y-2">
              {annotationFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                  <div className="flex-1 truncate">{file.name}</div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Timelines Visualization */}
        {annotationFiles.length > 0 && !frameIntervalError && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Annotation Timelines</h3>
            
            <div className="flex mb-2">
              <div className="w-1/2 pr-2">
                <div className="text-center font-medium text-sm text-gray-700 mb-1">Doctor Gaze</div>
                <div className="flex space-x-2 mb-1 text-xs">
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded bg-green-500 mr-1"></span>
                    <span>Patient</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded bg-red-500 mr-1"></span>
                    <span>Screen</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded bg-gray-400 mr-1"></span>
                    <span>Elsewhere</span>
                  </div>
                </div>
              </div>
              <div className="w-1/2 pl-2">
                <div className="text-center font-medium text-sm text-gray-700 mb-1">Patient Gaze</div>
                <div className="flex space-x-2 mb-1 text-xs">
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded bg-green-500 mr-1"></span>
                    <span>Doctor</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded bg-red-500 mr-1"></span>
                    <span>Screen</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded bg-gray-400 mr-1"></span>
                    <span>Elsewhere</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              {annotationFiles.map((file) => (
                <div key={file.id} className="flex">
                  <div className="w-1/2 pr-2">
                    <div className="flex items-center mb-1">
                      <div className="text-xs font-medium text-gray-700 truncate flex-1">
                        {file.name}
                      </div>
                    </div>
                    <canvas
                      ref={(el) => doctorCanvasRefs.current[file.id] = el}
                      width={1000}
                      height={20}
                      className="w-full h-5 rounded"
                    />
                  </div>
                  <div className="w-1/2 pl-2">
                    <div className="flex items-center mb-1">
                      <div className="text-xs font-medium text-gray-700 truncate flex-1">
                        {file.name}
                      </div>
                    </div>
                    <canvas
                      ref={(el) => patientCanvasRefs.current[file.id] = el}
                      width={1000}
                      height={20}
                      className="w-full h-5 rounded"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Kappa Results */}
        {kappaResults && !frameIntervalError && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Fleiss's Kappa Agreement Results</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Doctor Fleiss's Kappa */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-base font-medium mb-3">Doctor Gaze Agreement</h4>
                
                <div className={`mb-4 p-3 rounded-md ${getKappaColor(kappaResults.doctor.fleissKappa)}`}>
                  <div className="font-medium mb-1">Fleiss's Kappa (3 Raters):</div>
                  <div className="text-2xl font-bold">{formatKappa(kappaResults.doctor.fleissKappa)}</div>
                </div>
              </div>
              
              {/* Patient Fleiss's Kappa */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-base font-medium mb-3">Patient Gaze Agreement</h4>
                
                <div className={`mb-4 p-3 rounded-md ${getKappaColor(kappaResults.patient.fleissKappa)}`}>
                  <div className="font-medium mb-1">Fleiss's Kappa (3 Raters):</div>
                  <div className="text-2xl font-bold">{formatKappa(kappaResults.patient.fleissKappa)}</div>
                </div>
              </div>
            </div>
            
            {/* Pairwise Comparisons */}
            <div className="mt-6">
              <h4 className="text-base font-medium mb-3">Pairwise Cohen's Kappa Comparisons</h4>
              
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white rounded-lg overflow-hidden">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        File Pair
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Doctor Kappa
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Patient Kappa
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {kappaResults.doctor.pairwise.map((pair, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="py-2 px-3 text-sm">
                          <div className="truncate max-w-xs">
                            {pair.file1} <span className="text-gray-400">vs</span> {pair.file2}
                          </div>
                        </td>
                        <td className={`py-2 px-3 text-sm ${getKappaColor(pair.kappa)}`}>
                          {formatKappa(pair.kappa)}
                        </td>
                        <td className={`py-2 px-3 text-sm ${getKappaColor(kappaResults.patient.pairwise[index]?.kappa)}`}>
                          {formatKappa(kappaResults.patient.pairwise[index]?.kappa)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Kappa Interpretation Guide */}
              <div className="mt-6 bg-gray-50 p-3 rounded-md">
                <h5 className="text-sm font-medium mb-2">Kappa Interpretation Guide</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-red-100 mr-1 rounded"></span>
                    <span>≤ 0: Poor</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-red-50 mr-1 rounded"></span>
                    <span>0.01-0.20: Slight</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-yellow-50 mr-1 rounded"></span>
                    <span>0.21-0.40: Fair</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-yellow-100 mr-1 rounded"></span>
                    <span>0.41-0.60: Moderate</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-green-100 mr-1 rounded"></span>
                    <span>0.61-0.80: Substantial</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-green-200 mr-1 rounded"></span>
                    <span>0.81-1.00: Almost Perfect</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Need 3 Files Message */}
        {annotationFiles.length > 0 && annotationFiles.length < 3 && !frameIntervalError && (
          <div className="py-8 text-center bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-yellow-600 mb-2">
              <AlertTriangle className="h-8 w-8 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-yellow-800 mb-2">
              Need {3 - annotationFiles.length} More File{3 - annotationFiles.length > 1 ? 's' : ''}
            </h3>
            <p className="text-yellow-700 max-w-md mx-auto">
              Fleiss's kappa requires exactly 3 annotation files. Please upload {3 - annotationFiles.length} more file{3 - annotationFiles.length > 1 ? 's' : ''} to calculate inter-rater agreement.
            </p>
          </div>
        )}
        
        {/* No Files Uploaded Message */}
        {annotationFiles.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-gray-500 mb-4">
              <Upload className="h-12 w-12 mx-auto text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Annotation Files Uploaded</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Upload exactly 3 annotation JSON files to calculate Fleiss's kappa agreement between raters and visualize timeline comparisons.
            </p>
          </div>
        )}
        
        {/* Instructions */}
        <div className="mt-8 bg-blue-50 p-4 rounded-md">
          <h4 className="text-base font-medium text-blue-800 mb-2">How to Use This Tool</h4>
          <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
            <li>Upload <strong>exactly 3</strong> annotation files (JSON) containing gaze annotations from different raters</li>
            <li>Files should be from the same video for valid comparison</li>
            <li><strong>All files must use the same frame interval setting</strong> (e.g., all annotated every 10 frames)</li>
            <li>The tool will calculate Fleiss's kappa for overall agreement between all 3 raters</li>
            <li>Pairwise Cohen's kappa shows agreement between each pair of raters</li>
            <li>Kappa values range from -1 to 1, with 1 being perfect agreement</li>
            <li>Visualize timelines for each file to see differences</li>
            <li>Use this to evaluate inter-rater reliability in annotation studies</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default KappaAgreement;