"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, BarChart3, Trash2, RefreshCw } from "lucide-react";

const KappaAgreement = () => {
  const [annotationFiles, setAnnotationFiles] = useState([]);
  const [videoInfo, setVideoInfo] = useState(null);
  const [kappaResults, setKappaResults] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // References to canvas elements
  const doctorCanvasRefs = useRef({});
  const patientCanvasRefs = useRef({});
  
  // Add annotation file to state
  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setLoading(true);
    
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
      
      setAnnotationFiles(prev => [...prev, ...newAnnotationFiles]);
      
      // Calculate kappa if we have at least 2 files
      if (annotationFiles.length + newAnnotationFiles.length >= 2) {
        calculateKappa([...annotationFiles, ...newAnnotationFiles]);
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
      
      // Recalculate kappa if we still have at least 2 files
      if (updated.length >= 2) {
        calculateKappa(updated);
      } else {
        setKappaResults(null);
      }
      
      return updated;
    });
  };
  
  // Calculate kappa agreement
  const calculateKappa = (files) => {
    if (!files || files.length < 2) {
      setKappaResults(null);
      return;
    }
    
    setLoading(true);
    
    try {
      // Get total frames from first file or use default
      const totalFrames = files[0]?.data[1]?.videoInfo?.totalFrames || 1000;
      
      // Categories for doctor and patient
      const doctorCategories = ["rightPersonGaze", "rightPersonScreen", "rightPersonElsewhere"];
      const patientCategories = ["leftPersonGaze", "leftPersonScreen", "leftPersonElsewhere"];
      
      // Initialize results structure
      const results = {
        doctor: {
          // Kappa for each pair of files
          pairwise: [],
          // Overall agreement
          overall: {}
        },
        patient: {
          pairwise: [],
          overall: {}
        }
      };
      
      // Generate frame-by-frame annotations for each file
      const frameAnnotations = files.map(file => {
        const data = file.data[1]?.manualAnnotations;
        if (!data) return { doctor: {}, patient: {} };
        
        const doctorFrames = {};
        const patientFrames = {};
        
        // Process doctor annotations
        for (let category = 0; category < doctorCategories.length; category++) {
          const categoryName = doctorCategories[category];
          const ranges = data[categoryName] || [];
          
          ranges.forEach(range => {
            for (let frame = range.startFrame; frame <= range.endFrame; frame++) {
              doctorFrames[frame] = category + 1; // 1 = rightPersonGaze, 2 = rightPersonScreen, 3 = rightPersonElsewhere
            }
          });
        }
        
        // Process patient annotations
        for (let category = 0; category < patientCategories.length; category++) {
          const categoryName = patientCategories[category];
          const ranges = data[categoryName] || [];
          
          ranges.forEach(range => {
            for (let frame = range.startFrame; frame <= range.endFrame; frame++) {
              patientFrames[frame] = category + 1; // 1 = leftPersonGaze, 2 = leftPersonScreen, 3 = leftPersonElsewhere
            }
          });
        }
        
        return {
          doctor: doctorFrames,
          patient: patientFrames
        };
      });
      
      // Calculate pairwise kappa for doctor annotations
      for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
          // Doctor kappa
          const doctorKappa = calculateCohenKappa(
            frameAnnotations[i].doctor,
            frameAnnotations[j].doctor,
            totalFrames,
            3 // Number of categories (1-3)
          );
          
          results.doctor.pairwise.push({
            file1: files[i].name,
            file2: files[j].name,
            kappa: doctorKappa
          });
          
          // Patient kappa
          const patientKappa = calculateCohenKappa(
            frameAnnotations[i].patient,
            frameAnnotations[j].patient,
            totalFrames,
            3 // Number of categories (1-3)
          );
          
          results.patient.pairwise.push({
            file1: files[i].name,
            file2: files[j].name,
            kappa: patientKappa
          });
        }
      }
      
      // Calculate overall kappa for doctor and patient
      // For each category pair (looking at patient/screen/elsewhere)
      for (let category = 1; category <= 3; category++) {
        // Doctor overall kappa for this category
        const doctorCategoryResults = calculateOverallKappa(
          frameAnnotations.map(a => a.doctor),
          totalFrames,
          category
        );
        
        results.doctor.overall[`category${category}`] = {
          name: doctorCategories[category - 1],
          kappa: doctorCategoryResults.kappa,
          agreement: doctorCategoryResults.agreement
        };
        
        // Patient overall kappa for this category
        const patientCategoryResults = calculateOverallKappa(
          frameAnnotations.map(a => a.patient),
          totalFrames,
          category
        );
        
        results.patient.overall[`category${category}`] = {
          name: patientCategories[category - 1],
          kappa: patientCategoryResults.kappa,
          agreement: patientCategoryResults.agreement
        };
      }
      
      // Overall kappa across all annotations
      results.doctor.totalKappa = calculateTotalKappa(
        frameAnnotations.map(a => a.doctor),
        totalFrames,
        3
      );
      
      results.patient.totalKappa = calculateTotalKappa(
        frameAnnotations.map(a => a.patient),
        totalFrames,
        3
      );
      
      setKappaResults(results);
    } catch (error) {
      console.error("Error calculating kappa:", error);
      alert("Error calculating kappa agreement. Please check the files and try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to calculate Cohen's Kappa
  const calculateCohenKappa = (annotations1, annotations2, totalFrames, numCategories) => {
    let observedAgreement = 0;
    let totalOverlappingFrames = 0;
    
    // Count agreements
    for (let frame = 0; frame < totalFrames; frame++) {
      const value1 = annotations1[frame] || 0;
      const value2 = annotations2[frame] || 0;
      
      // If both have a value for this frame
      if (value1 && value2) {
        totalOverlappingFrames++;
        if (value1 === value2) {
          observedAgreement++;
        }
      }
    }
    
    if (totalOverlappingFrames === 0) return 0;
    
    // Calculate observed agreement (po)
    const po = observedAgreement / totalOverlappingFrames;
    
    // Calculate expected agreement (pe)
    // Count occurrences of each category in each annotation set
    const counts1 = Array(numCategories + 1).fill(0);
    const counts2 = Array(numCategories + 1).fill(0);
    
    for (let frame = 0; frame < totalFrames; frame++) {
      const value1 = annotations1[frame] || 0;
      const value2 = annotations2[frame] || 0;
      
      if (value1) counts1[value1]++;
      if (value2) counts2[value2]++;
    }
    
    // Calculate probabilities
    let pe = 0;
    for (let category = 1; category <= numCategories; category++) {
      const p1 = counts1[category] / totalOverlappingFrames;
      const p2 = counts2[category] / totalOverlappingFrames;
      pe += p1 * p2;
    }
    
    // Calculate kappa
    return (po - pe) / (1 - pe);
  };
  
  // Helper function to calculate overall kappa for a specific category across all files
  const calculateOverallKappa = (allAnnotations, totalFrames, category) => {
    let totalAgreements = 0;
    let totalPossibleAgreements = 0;
    
    // For each frame
    for (let frame = 0; frame < totalFrames; frame++) {
      // Count files that have this category at this frame
      let filesWithCategory = 0;
      let filesWithAnnotation = 0;
      
      allAnnotations.forEach(annotations => {
        if (annotations[frame]) {
          filesWithAnnotation++;
          if (annotations[frame] === category) {
            filesWithCategory++;
          }
        }
      });
      
      // If at least one file has an annotation for this frame
      if (filesWithAnnotation > 0) {
        const agreements = (filesWithCategory * (filesWithCategory - 1)) / 2;
        const disagreements = ((filesWithAnnotation - filesWithCategory) * filesWithCategory);
        
        totalAgreements += agreements;
        totalPossibleAgreements += (filesWithAnnotation * (filesWithAnnotation - 1)) / 2;
      }
    }
    
    // Calculate observed agreement
    const po = totalAgreements / (totalPossibleAgreements || 1);
    
    // Calculate expected agreement (by chance)
    // Count category occurrences in each file
    const categoryProbs = allAnnotations.map(annotations => {
      let categoryCount = 0;
      let totalAnnotated = 0;
      
      Object.values(annotations).forEach(value => {
        totalAnnotated++;
        if (value === category) categoryCount++;
      });
      
      return categoryCount / (totalAnnotated || 1);
    });
    
    // Calculate pe
    let pe = 0;
    for (let i = 0; i < categoryProbs.length; i++) {
      for (let j = i + 1; j < categoryProbs.length; j++) {
        pe += categoryProbs[i] * categoryProbs[j];
      }
    }
    
    pe = pe / (categoryProbs.length * (categoryProbs.length - 1) / 2);
    
    // Calculate kappa
    const kappa = (po - pe) / (1 - pe);
    
    return {
      kappa: isNaN(kappa) ? 0 : kappa,
      agreement: po
    };
  };
  
  // Calculate total kappa across all categories
  const calculateTotalKappa = (allAnnotations, totalFrames, numCategories) => {
    let totalAgreements = 0;
    let totalPossibleAgreements = 0;
    
    // For each frame
    for (let frame = 0; frame < totalFrames; frame++) {
      // Get all annotations for this frame
      const frameAnnotations = allAnnotations.map(annotations => annotations[frame] || 0);
      
      // Count files with annotations for this frame
      const filesWithAnnotation = frameAnnotations.filter(value => value > 0).length;
      
      if (filesWithAnnotation > 1) {
        // Count agreements
        for (let i = 0; i < frameAnnotations.length; i++) {
          for (let j = i + 1; j < frameAnnotations.length; j++) {
            if (frameAnnotations[i] && frameAnnotations[j]) {
              totalPossibleAgreements++;
              if (frameAnnotations[i] === frameAnnotations[j]) {
                totalAgreements++;
              }
            }
          }
        }
      }
    }
    
    // Calculate observed agreement
    const po = totalAgreements / (totalPossibleAgreements || 1);
    
    // Calculate expected agreement
    // Count category occurrences across all files
    const categoryCounts = Array(numCategories + 1).fill(0);
    let totalValues = 0;
    
    allAnnotations.forEach(annotations => {
      Object.values(annotations).forEach(value => {
        if (value > 0) {
          categoryCounts[value]++;
          totalValues++;
        }
      });
    });
    
    // Calculate probabilities
    const categoryProbs = categoryCounts.map(count => count / (totalValues || 1));
    
    // Calculate pe
    let pe = 0;
    for (let i = 1; i <= numCategories; i++) {
      pe += categoryProbs[i] * categoryProbs[i];
    }
    
    // Calculate kappa
    const kappa = (po - pe) / (1 - pe);
    
    return {
      kappa: isNaN(kappa) ? 0 : kappa,
      agreement: po
    };
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
          case 0: doctorCtx.fillStyle = '#ef4444'; break; // Red for looking at patient
          case 1: doctorCtx.fillStyle = '#3b82f6'; break; // Blue for looking at screen
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
          case 0: patientCtx.fillStyle = '#ef4444'; break; // Red for looking at doctor
          case 1: patientCtx.fillStyle = '#3b82f6'; break; // Blue for looking at screen
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
                Upload multiple annotation files for comparison. Files must share the same video.
              </div>
            </div>
            
            {annotationFiles.length >= 2 && (
              <button
                onClick={() => calculateKappa(annotationFiles)}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center"
              >
                {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                Recalculate Kappa
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
        {annotationFiles.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4">Annotation Timelines</h3>
            
            <div className="flex mb-2">
              <div className="w-1/2 pr-2">
                <div className="text-center font-medium text-sm text-gray-700 mb-1">Doctor Gaze</div>
                <div className="flex space-x-2 mb-1 text-xs">
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded bg-red-500 mr-1"></span>
                    <span>Patient</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded bg-blue-500 mr-1"></span>
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
                    <span className="inline-block w-3 h-3 rounded bg-red-500 mr-1"></span>
                    <span>Doctor</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded bg-blue-500 mr-1"></span>
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
        {kappaResults && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Kappa Agreement Results</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Doctor Overall Kappa */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-base font-medium mb-3">Doctor Gaze Agreement</h4>
                
                <div className={`mb-4 p-3 rounded-md ${getKappaColor(kappaResults.doctor.totalKappa?.kappa)}`}>
                  <div className="font-medium mb-1">Overall Kappa:</div>
                  <div className="text-2xl font-bold">{formatKappa(kappaResults.doctor.totalKappa?.kappa)}</div>
                  <div className="text-sm text-gray-600">
                    Agreement: {Math.round(kappaResults.doctor.totalKappa?.agreement * 100)}%
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="font-medium mb-1">By Category:</div>
                  
                  {/* Looking at Doctor */}
                  <div className={`p-2 rounded-md ${getKappaColor(kappaResults.patient.overall.category1?.kappa)}`}>
                    <div className="flex items-center mb-1">
                      <span className="inline-block w-3 h-3 rounded bg-red-500 mr-2"></span>
                      <span className="font-medium">Looking at Doctor</span>
                    </div>
                    <div className="flex justify-between">
                      <div>Kappa: {formatKappa(kappaResults.patient.overall.category1?.kappa)}</div>
                      <div className="text-sm text-gray-600">
                        Agreement: {Math.round(kappaResults.patient.overall.category1?.agreement * 100)}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Looking at Screen */}
                  <div className={`p-2 rounded-md ${getKappaColor(kappaResults.patient.overall.category2?.kappa)}`}>
                    <div className="flex items-center mb-1">
                      <span className="inline-block w-3 h-3 rounded bg-blue-500 mr-2"></span>
                      <span className="font-medium">Looking at Screen</span>
                    </div>
                    <div className="flex justify-between">
                      <div>Kappa: {formatKappa(kappaResults.patient.overall.category2?.kappa)}</div>
                      <div className="text-sm text-gray-600">
                        Agreement: {Math.round(kappaResults.patient.overall.category2?.agreement * 100)}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Looking Elsewhere */}
                  <div className={`p-2 rounded-md ${getKappaColor(kappaResults.patient.overall.category3?.kappa)}`}>
                    <div className="flex items-center mb-1">
                      <span className="inline-block w-3 h-3 rounded bg-gray-400 mr-2"></span>
                      <span className="font-medium">Looking Elsewhere</span>
                    </div>
                    <div className="flex justify-between">
                      <div>Kappa: {formatKappa(kappaResults.patient.overall.category3?.kappa)}</div>
                      <div className="text-sm text-gray-600">
                        Agreement: {Math.round(kappaResults.patient.overall.category3?.agreement * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Pairwise Comparisons */}
            <div className="mt-6">
              <h4 className="text-base font-medium mb-3">Pairwise Kappa Comparisons</h4>
              
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
        
        {/* No Files Uploaded Message */}
        {annotationFiles.length === 0 && (
          <div className="py-12 text-center">
            <div className="text-gray-500 mb-4">
              <Upload className="h-12 w-12 mx-auto text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Annotation Files Uploaded</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Upload at least two annotation JSON files to calculate kappa agreement and visualize timeline comparisons.
            </p>
          </div>
        )}
        
        {/* Instructions */}
        <div className="mt-8 bg-blue-50 p-4 rounded-md">
          <h4 className="text-base font-medium text-blue-800 mb-2">How to Use This Tool</h4>
          <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
            <li>Upload two or more annotation files (JSON) containing gaze annotations</li>
            <li>Files should be from the same video for valid comparison</li>
            <li>The tool will calculate Cohen's Kappa for each pair of annotations</li>
            <li>Kappa values range from -1 to 1, with 1 being perfect agreement</li>
            <li>Visualize timelines for each file to see differences</li>
            <li>Use this to evaluate inter-rater reliability or AI model accuracy</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default KappaAgreement;