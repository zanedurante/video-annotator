import VideoAnnotator from '@/components/video-annotator/VideoAnnotator'

export default function Home() {
  return (
    <main className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Video Annotation Tool</h1>
      <VideoAnnotator />
    </main>
  )
}