"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Camera, Edit2, Scissors, Trash2 } from 'lucide-react';

// Types for our annotations
interface Annotation {
  id: string;
  frame: number;
  endFrame: number | null;
  gaze: string;
  createdAt: number;
  modifiedAt: number | null;
}

interface AnnotationSet {
  human1: Annotation[];
  human2: Annotation[];
}

const VideoAnnotator = () => {
  const [video, setVideo] = useState<string | null>(null);
  const [frameInterval, setFrameInterval] = useState(1);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [fps, setFps] = useState(30);
  const [activeAnnotator, setActiveAnnotator] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<{ human: string; id: string } | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const keydownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [annotations, setAnnotations] = useState<AnnotationSet>({
    human1: [{ 
      id: '1',
      frame: 0, 
      gaze: 'neither', 
      endFrame: null,
      createdAt: Date.now(),
      modifiedAt: null
    }],
    human2: [{ 
      id: '2',
      frame: 0, 
      gaze: 'neither', 
      endFrame: null,
      createdAt: Date.now(),
      modifiedAt: null
    }]
  });

  const GAZE_TYPES = {
    SCREEN: { value: 'screen', color: '#EF4444', key: 's', label: 'Screen' },
    HUMAN: { value: 'human', color: '#22C55E', key: 'h', label: 'Human' },
    NEITHER: { value: 'neither', color: '#EAB308', key: 'n', label: 'Neither' }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Please select a valid video file.');
      return;
    }

    try {
      const url = URL.createObjectURL(file);
      setVideo(url);
      setCurrentFrame(0);
      setActiveAnnotator(null);
      
      const videoEl = document.createElement('video');
      videoEl.src = url;
      
      await new Promise((resolve, reject) => {
        videoEl.onloadedmetadata = () => {
          const calculatedFps = Math.round(videoEl.duration * fps);
          setTotalFrames(calculatedFps);
          setFps(30);
          
          if (videoRef.current) {
            videoRef.current.src = url;
            videoRef.current.currentTime = 0;
          }

          setAnnotations({
            human1: [{ frame: 0, gaze: 'neither', endFrame: null }],
            human2: [{ frame: 0, gaze: 'neither', endFrame: null }]
          });

          resolve(true);
        };
        videoEl.onerror = reject;
        
        setTimeout(() => reject(new Error('Video loading timeout')), 10000);
      });
    } catch (error) {
      console.error('Error loading video:', error);
      alert('Error loading video. Please try another file.');
    }
  };

  const updateFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (error) {
        console.error('Error drawing video frame:', error);
      }
    }
  }, []);

  const addAnnotation = useCallback((human: number, gazeType: string) => {
    if (activeAnnotator && `human${human}` !== activeAnnotator) return;

    const humanKey = `human${human}` as keyof typeof annotations;
    setAnnotations(prev => {
      const humanAnnotations = [...prev[humanKey]];
      const currentAnnotationIndex = humanAnnotations.findIndex(anno => 
        anno.frame <= currentFrame && (anno.endFrame === null || anno.endFrame >= currentFrame)
      );

      if (currentAnnotationIndex !== -1) {
        const existingAnnotation = humanAnnotations[currentAnnotationIndex];
        if (existingAnnotation.gaze === gazeType) return prev;
        
        existingAnnotation.endFrame = currentFrame - 1;
        
        humanAnnotations.splice(currentAnnotationIndex + 1, 0, {
          frame: currentFrame,
          gaze: gazeType,
          endFrame: null
        });
      } else {
        if (humanAnnotations.length > 0) {
          const lastAnnotation = humanAnnotations[humanAnnotations.length - 1];
          if (lastAnnotation.endFrame === null) {
            lastAnnotation.endFrame = currentFrame - 1;
          }
        }
        humanAnnotations.push({
          frame: currentFrame,
          gaze: gazeType,
          endFrame: null
        });
      }

      return {
        ...prev,
        [humanKey]: humanAnnotations
      };
    });
  }, [currentFrame, activeAnnotator]);

  const startContinuousFrameAdvance = useCallback((amount: number) => {
    if (keydownIntervalRef.current) return;
    
    const advance = () => {
      setCurrentFrame(prev => {
        const next = prev + amount;
        return Math.max(0, Math.min(next, totalFrames));
      });
    };

    advance();
    keydownIntervalRef.current = setInterval(advance, 100);
  }, [totalFrames]);

  const stopContinuousFrameAdvance = useCallback(() => {
    if (keydownIntervalRef.current) {
      clearInterval(keydownIntervalRef.current);
      keydownIntervalRef.current = null;
    }
  }, []);

  const startContinuousAnnotation = useCallback((human: number, gazeType: string) => {
    if (keydownIntervalRef.current) return;
    
    const annotate = () => {
      addAnnotation(human, gazeType);
      setCurrentFrame(prev => Math.min(totalFrames, prev + 1));
    };
    
    annotate();
    keydownIntervalRef.current = setInterval(annotate, 100);
  }, [addAnnotation, totalFrames]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        startContinuousFrameAdvance(frameInterval);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        startContinuousFrameAdvance(event.shiftKey ? -10 : -1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        startContinuousFrameAdvance(event.shiftKey ? 10 : 1);
        break;
      case 'Digit1':
        if (!event.repeat) startContinuousAnnotation(1, GAZE_TYPES.HUMAN.value);
        break;
      case 'Digit2':
        if (!event.repeat) startContinuousAnnotation(1, GAZE_TYPES.SCREEN.value);
        break;
      case 'Digit3':
        if (!event.repeat) startContinuousAnnotation(1, GAZE_TYPES.NEITHER.value);
        break;
      case 'Digit4':
        if (!event.repeat) startContinuousAnnotation(2, GAZE_TYPES.HUMAN.value);
        break;
      case 'Digit5':
        if (!event.repeat) startContinuousAnnotation(2, GAZE_TYPES.NEITHER.value);
        break;
      default:
        break;
    }
  }, [frameInterval, startContinuousFrameAdvance, startContinuousAnnotation]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (['Space', 'ArrowLeft', 'ArrowRight', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(event.code)) {
      stopContinuousFrameAdvance();
    }
  }, [stopContinuousFrameAdvance]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      stopContinuousFrameAdvance();
    };
  }, [handleKeyDown, handleKeyUp, stopContinuousFrameAdvance]);

  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      video.addEventListener('seeked', updateFrame);
      video.addEventListener('loadeddata', updateFrame);
      return () => {
        video.removeEventListener('seeked', updateFrame);
        video.removeEventListener('loadeddata', updateFrame);
      };
    }
  }, [updateFrame]);

  useEffect(() => {
    if (videoRef.current && typeof currentFrame === 'number') {
      videoRef.current.currentTime = currentFrame / fps;
    }
  }, [currentFrame, fps]);

  const renderTimeline = (annotations: Array<{ frame: number; gaze: string; endFrame: number | null }>) => {
    const width = 400; // Changed from 800 to 400
    const height = 48;
    
    // Prevent division by zero and handle edge cases
    const safeTotalFrames = Math.max(1, totalFrames);
    
    // Convert frame positions to SVG coordinates with safety checks and bounds
    const getX = (frame: number): number => {
      if (typeof frame !== 'number' || isNaN(frame)) return 0;
      const safeFrame = Math.min(Math.max(0, frame), safeTotalFrames);
      return Math.min(width, Math.floor((safeFrame / safeTotalFrames) * width));
    };

    // Calculate proper end position for segments
    const getSegmentWidth = (start: number, end: number | null): number => {
      const startX = getX(start);
      const currentX = getX(end ?? currentFrame);
      
      // Ensure the segment width is proportional and bounded
      const maxWidth = width - startX;
      const rawWidth = currentX - startX;
      return Math.max(2, Math.min(maxWidth, rawWidth));
    };

    return (
      <div className="w-full">
        <svg 
          width={width} 
          height={height} 
          viewBox={`0 0 ${width} ${height}`}
          className="border border-gray-300 rounded-lg bg-gray-50"
        >
          <defs>
            <clipPath id="timeline-clip">
              <rect x="0" y="0" width={width} height={height} />
            </clipPath>
          </defs>
          
          <g clipPath="url(#timeline-clip)">
            {/* Frame markers */}
            {Array.from({ length: 11 }).map((_, i) => {
              const frame = Math.floor((safeTotalFrames / 10) * i);
              const x = getX(frame);
              return (
                <g key={i}>
                  <line 
                    x1={x.toString()} 
                    y1="0" 
                    x2={x.toString()} 
                    y2={height.toString()} 
                    stroke="rgba(0,0,0,0.1)" 
                    strokeWidth="1"
                  />
                  <text 
                    x={x.toString()} 
                    y={(height - 4).toString()} 
                    textAnchor="middle" 
                    className="text-xs fill-gray-500"
                  >
                    {frame}
                  </text>
                </g>
              );
            })}

            {/* Annotation segments */}
            {annotations.map((anno, idx) => {
              const startX = getX(anno.frame);
              const segmentWidth = getSegmentWidth(anno.frame, anno.endFrame);
              
              // Skip if the segment would be outside the visible area
              if (startX >= width || segmentWidth <= 0) return null;
              
              let color;
              switch(anno.gaze) {
                case 'human':
                  color = GAZE_TYPES.HUMAN.color;
                  break;
                case 'screen':
                  color = GAZE_TYPES.SCREEN.color;
                  break;
                case 'neither':
                  color = GAZE_TYPES.NEITHER.color;
                  break;
                default:
                  color = '#6B7280';
              }

              return (
                <rect
                  key={idx}
                  x={startX.toString()}
                  y="0"
                  width={segmentWidth.toString()}
                  height={height.toString()}
                  fill={color}
                  opacity="0.75"
                >
                  <title>{`Frame ${anno.frame} - ${anno.endFrame || 'current'}: ${anno.gaze}`}</title>
                </rect>
              );
            })}

            {/* Current frame marker */}
            <line
              x1={getX(currentFrame).toString()}
              y1="0"
              x2={getX(currentFrame).toString()}
              y2={height.toString()}
              stroke="#3B82F6"
              strokeWidth="2"
            />
          </g>
        </svg>
        {/* Edit mode controls */}
        {editMode && selectedSegment && (
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const annotation = findAnnotationAtFrame(selectedSegment.human, currentFrame);
                if (annotation) {
                  splitAnnotation(selectedSegment.human, annotation.id);
                }
              }}
              className="flex items-center gap-1"
            >
              <Scissors className="h-4 w-4" />
              Split
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => deleteAnnotation(selectedSegment.human, selectedSegment.id)}
              className="flex items-center gap-1 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 
                         file:rounded-md file:border-0 file:text-sm file:font-semibold 
                         file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <Select
                value={frameInterval.toString()}
                onValueChange={(value) => setFrameInterval(parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 frame</SelectItem>
                  <SelectItem value="5">5 frames</SelectItem>
                  <SelectItem value="10">10 frames</SelectItem>
                  <SelectItem value="20">20 frames</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Edit mode toggle */}
            <Button
              variant={editMode ? "default" : "outline"}
              onClick={() => {
                setEditMode(!editMode);
                setSelectedSegment(null);
              }}
              className="flex items-center gap-2"
            >
              <Edit2 className="h-4 w-4" />
              {editMode ? "Exit Edit Mode" : "Edit Mode"}
            </Button>
          </div>

          {/* Navigation Controls */}
          <div className="flex justify-between items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
                className="bg-gray-700 hover:bg-gray-600"
                title="Previous frame (Left Arrow)"
              >
                Previous Frame
              </Button>
              <Button
                onClick={() => setCurrentFrame(Math.min(totalFrames, currentFrame + 1))}
                className="bg-gray-700 hover:bg-gray-600"
                title="Next frame (Right Arrow or Space)"
              >
                Next Frame
              </Button>
              <Button
                onClick={() => setCurrentFrame(Math.min(totalFrames, currentFrame + 10))}
                className="bg-gray-700 hover:bg-gray-600"
                title="Next 10 frames (Shift + Right)"
              >
                +10 Frames
              </Button>
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

          {/* Annotation Controls */}
          <div className="grid grid-cols-2 gap-8">
            {/* Doctor Controls */}
            <div>
              <h3 className="font-semibold mb-4 text-gray-800">Doctor Gaze</h3>
              <div className="space-y-2">
                <Button 
                  onClick={() => addAnnotation(1, GAZE_TYPES.HUMAN.value)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  title="Press 1"
                >
                  Looking at Patient (1)
                </Button>
                <Button 
                  onClick={() => addAnnotation(1, GAZE_TYPES.SCREEN.value)}
                  className="w-full bg-red-500 hover:bg-red-600 text-white"
                  title="Press 2"
                >
                  Looking at Screen (2)
                </Button>
                <Button 
                  onClick={() => addAnnotation(1, GAZE_TYPES.NEITHER.value)}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                  title="Press 3"
                >
                  Looking Elsewhere (3)
                </Button>
              </div>
              <div className="mt-4">
                {renderTimeline(annotations.human1)}
              </div>
            </div>

            {/* Patient Controls */}
            <div>
              <h3 className="font-semibold mb-4 text-gray-800">Patient Gaze</h3>
              <div className="space-y-2">
                <Button 
                  onClick={() => addAnnotation(2, GAZE_TYPES.HUMAN.value)}
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  title="Press 4"
                >
                  Looking at Doctor (4)
                </Button>
                <Button 
                  onClick={() => addAnnotation(2, GAZE_TYPES.NEITHER.value)}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                  title="Press 5"
                >
                  Looking Elsewhere (5)
                </Button>
              </div>
              <div className="mt-4">
                {renderTimeline(annotations.human2)}
              </div>
            </div>
          </div>

          {/* Keyboard Shortcuts Guide */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="font-semibold mb-4 text-gray-800">Keyboard Shortcuts</h3>
            <div className="grid grid-cols-3 gap-8">
              <div>
                <h4 className="font-medium mb-2 text-gray-700">Navigation</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>Space: Next Frame (hold to advance)</li>
                  <li>← →: Previous/Next Frame (hold to continue)</li>
                  <li>Shift + ← →: ±10 Frames (hold to continue)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2 text-gray-700">Doctor Annotations</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>1: Looking at Patient (hold to continue)</li>
                  <li>2: Looking at Screen (hold to continue)</li>
                  <li>3: Looking Elsewhere (hold to continue)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2 text-gray-700">Patient Annotations</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>4: Looking at Doctor (hold to continue)</li>
                  <li>5: Looking Elsewhere (hold to continue)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoAnnotator;