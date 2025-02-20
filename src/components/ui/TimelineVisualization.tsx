const TimelineVisualization = ({ 
  manualAnnotations, 
  modelData, 
  totalFrames 
}) => {
  // Process manual annotations to only fill until next annotation
  const processManualAnnotations = (annotations) => {
    if (!annotations || Object.keys(annotations).length === 0) return [];

    // Convert object to sorted array of keyframes
    const keyframes = Object.entries(annotations)
      .map(([frame, value]) => ({ frame: parseInt(frame), value }))
      .sort((a, b) => a.frame - b.startFrame);

    // Create segments between keyframes
    let segments = [];
    for (let i = 0; i < keyframes.length; i++) {
      const current = keyframes[i];
      const next = keyframes[i + 1];
      
      // If there's a next keyframe, fill until that one
      // If not, just show this frame as a small segment
      const endFrame = next ? next.frame - 1 : current.frame + 1;

      segments.push({
        startFrame: current.frame,
        endFrame: endFrame,
        value: current.value
      });
    }

    return segments;
  };

  // Process AI annotations from the model data
  const processModelAnnotations = () => {
    if (!modelData?.[1]?.manualAnnotations) return { doctor: [], patient: [] };

    const { leftPersonGaze, rightPersonGaze, rightPersonScreen } = modelData[1].manualAnnotations;

    // Process doctor segments
    // Note: No need to process frame by frame, we can use the ranges directly
    const doctorSegments = [
      // Convert leftPersonGaze (looking at patient) to value 1 segments
      ...(leftPersonGaze || []).map(range => ({
        startFrame: range.startFrame,
        endFrame: range.endFrame,
        value: 1  // looking at patient
      })),
      // Convert rightPersonScreen (looking at screen) to value 2 segments
      ...(rightPersonScreen || []).map(range => ({
        startFrame: range.startFrame,
        endFrame: range.endFrame,
        value: 2  // looking at screen
      }))
    ].sort((a, b) => a.startFrame - b.startFrame);

    // Process patient segments
    // Convert rightPersonGaze (looking at doctor) to value 4 segments
    const patientSegments = (rightPersonGaze || []).map(range => ({
      startFrame: range.startFrame,
      endFrame: range.endFrame,
      value: 4  // looking at doctor
    })).sort((a, b) => a.startFrame - b.startFrame);

    return {
      doctor: doctorSegments,
      patient: patientSegments
    };
  };

  const getSegmentColor = (value) => {
    if (value === 1 || value === 4) {
      return 'bg-green-500'; // Looking at person
    } else if (value === 2) {
      return 'bg-red-500';   // Looking at screen
    } else {
      return 'bg-gray-500';  // Looking elsewhere
    }
  };

  const manualDoctorSegments = processManualAnnotations(manualAnnotations.doctor, 'doctor');
  const manualPatientSegments = processManualAnnotations(manualAnnotations.patient, 'patient');
  const modelSegments = processModelAnnotations();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Doctor Gaze</h3>
        {/* Manual Timeline */}
        <div className="mb-2">
          <div className="text-sm text-gray-600 mb-1">Manual Annotations</div>
          <div className="h-6 w-full bg-gray-100 rounded-full relative">
            {manualDoctorSegments.map((segment, index) => (
              <div
                key={index}
                className={`absolute h-full ${getSegmentColor(segment.value)} transition-all`}
                style={{
                  left: `${(segment.startFrame / totalFrames) * 100}%`,
                  width: `${((segment.endFrame - segment.startFrame + 1) / totalFrames) * 100}%`
                }}
              />
            ))}
          </div>
        </div>
        {/* AI Timeline */}
        <div>
          <div className="text-sm text-gray-600 mb-1">AI Predictions</div>
          <div className="h-6 w-full bg-gray-100 rounded-full relative">
            {modelSegments.doctor.map((segment, index) => (
              <div
                key={index}
                className={`absolute h-full ${getSegmentColor(segment.value)} transition-all`}
                style={{
                  left: `${(segment.startFrame / totalFrames) * 100}%`,
                  width: `${((segment.endFrame - segment.startFrame + 1) / totalFrames) * 100}%`
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Patient Gaze</h3>
        {/* Manual Timeline */}
        <div className="mb-2">
          <div className="text-sm text-gray-600 mb-1">Manual Annotations</div>
          <div className="h-6 w-full bg-gray-100 rounded-full relative">
            {manualPatientSegments.map((segment, index) => (
              <div
                key={index}
                className={`absolute h-full ${getSegmentColor(segment.value, 'patient')} transition-all`}
                style={{
                  left: `${(segment.startFrame / totalFrames) * 100}%`,
                  width: `${((segment.endFrame - segment.startFrame + 1) / totalFrames) * 100}%`
                }}
              />
            ))}
          </div>
        </div>
        {/* AI Timeline */}
        <div>
          <div className="text-sm text-gray-600 mb-1">AI Predictions</div>
          <div className="h-6 w-full bg-gray-100 rounded-full relative">
            {modelSegments.patient.map((segment, index) => (
              <div
                key={index}
                className={`absolute h-full ${getSegmentColor(segment.value, true)} transition-all`}
                style={{
                  left: `${(segment.startFrame / totalFrames) * 100}%`,
                  width: `${((segment.endFrame - segment.startFrame + 1) / totalFrames) * 100}%`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineVisualization;