import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Loader2, 
  FileAudio, 
  Mic, 
  Check,
  ChevronDown,
  Volume2
} from 'lucide-react';
import { Scene, VoiceOption, VOICE_OPTIONS, Gender, PREVIEW_TEXT } from './types';
import { generateSpeech } from './services/geminiService';
import { createWavBlob } from './utils';

const App: React.FC = () => {
  const [scenes, setScenes] = useState<Scene[]>([
    { id: '1', text: 'Chào mừng các bạn đến với video giới thiệu sản phẩm mới của chúng tôi.', isGenerating: false, isPlaying: false },
    { id: '2', text: 'Đây là tính năng đột phá giúp bạn tiết kiệm 50% thời gian làm việc.', isGenerating: false, isPlaying: false },
    { id: 'C3', text: 'Hãy cùng xem demo chi tiết ngay sau đây.', isGenerating: false, isPlaying: false },
  ]);

  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICE_OPTIONS.find(v => v.name === 'Sadachbia') || VOICE_OPTIONS[9]);
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize Audio Context on user interaction
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const handleGenerate = async (sceneId: string) => {
    initAudioContext();
    
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isGenerating: true } : s));
    
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    try {
      const pcmData = await generateSpeech(scene.text, selectedVoice.name);
      
      // Create Blob URL for potential standard HTML5 audio usage if needed, 
      // but we will mainly use PCM data for playback to be precise with sample rate.
      const wavBlob = createWavBlob(pcmData);
      const audioUrl = URL.createObjectURL(wavBlob);

      setScenes(prev => prev.map(s => s.id === sceneId ? { 
        ...s, 
        isGenerating: false, 
        audioData: pcmData,
        audioUrl: audioUrl
      } : s));

    } catch (error) {
      alert(`Error generating voice for Scene ${sceneId}: ${error}`);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isGenerating: false } : s));
    }
  };

  const handleGenerateAll = async () => {
    initAudioContext();
    // Sequentially generate to avoid rate limits
    for (const scene of scenes) {
      if (!scene.audioData && !scene.isGenerating) {
        await handleGenerate(scene.id);
      }
    }
  };

  const stopPlayback = () => {
    if (activeSourceRef.current) {
      activeSourceRef.current.stop();
      activeSourceRef.current = null;
    }
    setScenes(prev => prev.map(s => ({ ...s, isPlaying: false })));
    setPreviewPlaying(null);
  };

  const playAudio = async (sceneId: string) => {
    initAudioContext();
    stopPlayback(); // Stop any current audio

    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || !scene.audioData || !audioContextRef.current) return;

    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isPlaying: true } : s));

    try {
      // Decode the raw PCM wrapped in WAV or raw data. 
      // Since we stored raw PCM ArrayBuffer, we need to manually create a buffer or decode.
      // Easiest is to decode the WAV blob we created, or use raw data.
      // Let's use the raw PCM data and put it into an AudioBuffer manually to ensure sample rate matches 24kHz.
      
      const ctx = audioContextRef.current;
      
      // Create an AudioBuffer
      // 16-bit PCM is -32768 to 32767. We need Float32 -1.0 to 1.0
      const int16Data = new Int16Array(scene.audioData);
      const float32Data = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }

      const buffer = ctx.createBuffer(1, float32Data.length, 24000);
      buffer.copyToChannel(float32Data, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isPlaying: false } : s));
      };

      source.start();
      activeSourceRef.current = source;

    } catch (e) {
      console.error("Playback error", e);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isPlaying: false } : s));
    }
  };

  const handlePreviewVoice = async (voice: VoiceOption, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown selection
    initAudioContext();
    stopPlayback();
    setPreviewPlaying(voice.name);

    try {
      const pcmData = await generateSpeech(PREVIEW_TEXT, voice.name);
      if (!audioContextRef.current) return;
      
      const ctx = audioContextRef.current;
      const int16Data = new Int16Array(pcmData);
      const float32Data = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }
      const buffer = ctx.createBuffer(1, float32Data.length, 24000);
      buffer.copyToChannel(float32Data, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setPreviewPlaying(null);
      source.start();
      activeSourceRef.current = source;
    } catch (error) {
      console.error("Preview failed", error);
      setPreviewPlaying(null);
    }
  };

  const handleDownload = (scene: Scene) => {
    if (!scene.audioUrl) return;
    const a = document.createElement('a');
    a.href = scene.audioUrl;
    a.download = `${scene.id}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadAll = () => {
    scenes.forEach(scene => {
      if (scene.audioUrl) {
        // Slight delay to prevent browser blocking multiple downloads
        setTimeout(() => handleDownload(scene), 100);
      }
    });
  };

  const handleScriptChange = (id: string, newText: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, text: newText, audioData: undefined, audioUrl: undefined } : s));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Kịch Bản & Voice Studio</h1>
            <p className="text-secondary mt-1">Tạo giọng đọc AI chuyên nghiệp với Gemini 2.5</p>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Voice Selector */}
             <div className="relative">
              <button 
                onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg shadow-sm hover:border-primary transition-colors min-w-[240px] justify-between"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${selectedVoice.gender === Gender.MALE ? 'bg-blue-500' : 'bg-pink-500'}`}></div>
                  <span className="font-medium">{selectedVoice.name}</span>
                  <span className="text-xs text-slate-400">({selectedVoice.gender})</span>
                </div>
                <ChevronDown size={16} />
              </button>

              {isVoiceDropdownOpen && (
                <div className="absolute top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="max-h-[400px] overflow-y-auto">
                    {[Gender.FEMALE, Gender.MALE].map(gender => (
                      <div key={gender}>
                        <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0">
                          Giọng {gender === Gender.FEMALE ? 'Nữ' : 'Nam'}
                        </div>
                        {VOICE_OPTIONS.filter(v => v.gender === gender).map(voice => (
                          <div 
                            key={voice.name}
                            onClick={() => {
                              setSelectedVoice(voice);
                              setIsVoiceDropdownOpen(false);
                            }}
                            className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${selectedVoice.name === voice.name ? 'bg-indigo-50/50' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${gender === Gender.MALE ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
                                {voice.name.substring(0, 1)}
                              </div>
                              <span className={`text-sm ${selectedVoice.name === voice.name ? 'font-semibold text-primary' : 'text-slate-700'}`}>
                                {voice.name}
                              </span>
                            </div>
                            
                            <button
                              onClick={(e) => handlePreviewVoice(voice, e)}
                              className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-primary transition-colors"
                              title="Nghe thử giọng mẫu"
                            >
                              {previewPlaying === voice.name ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
             </div>

             <button 
               onClick={handleGenerateAll}
               className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-medium hover:bg-primary-hover shadow-lg shadow-indigo-200 transition-all active:scale-95"
             >
               <FileAudio size={18} />
               Tạo Tất Cả Voice
             </button>
             <button 
               onClick={handleDownloadAll}
               className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-lg font-medium hover:bg-slate-50 transition-all active:scale-95"
             >
               <Download size={18} />
               Tải Tất Cả
             </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-semibold w-24">Scene</th>
                <th className="px-6 py-4 font-semibold">Nội dung kịch bản</th>
                <th className="px-6 py-4 font-semibold w-[280px]">Voice AI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scenes.map((scene) => (
                <tr key={scene.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 align-top">
                    <div className="bg-slate-100 text-slate-600 font-bold text-sm px-3 py-1 rounded inline-block">
                      {scene.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <textarea 
                      value={scene.text}
                      onChange={(e) => handleScriptChange(scene.id, e.target.value)}
                      className="w-full bg-transparent border-0 focus:ring-0 p-0 text-slate-700 leading-relaxed resize-none h-24 placeholder-slate-300"
                      placeholder="Nhập nội dung thoại..."
                    />
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="flex flex-col gap-3">
                      {scene.isGenerating ? (
                        <div className="flex items-center gap-2 text-primary text-sm font-medium animate-pulse py-2">
                          <Loader2 size={16} className="animate-spin" />
                          Đang tạo voice...
                        </div>
                      ) : !scene.audioData ? (
                        <button 
                          onClick={() => handleGenerate(scene.id)}
                          className="flex items-center justify-center gap-2 w-full py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-primary hover:text-primary hover:bg-indigo-50 transition-all font-medium text-sm"
                        >
                          <Mic size={16} />
                          Tạo Voice
                        </button>
                      ) : (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex items-center justify-between gap-2 animate-in slide-in-from-bottom-2 duration-300">
                          
                          {/* Play/Pause Control */}
                          <button 
                            onClick={() => scene.isPlaying ? stopPlayback() : playAudio(scene.id)}
                            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                              scene.isPlaying 
                                ? 'bg-primary text-white shadow-md scale-105' 
                                : 'bg-white text-primary border border-indigo-100 hover:bg-indigo-50'
                            }`}
                          >
                            {scene.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                          </button>

                          <div className="h-8 w-px bg-indigo-200 mx-1"></div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleGenerate(scene.id)}
                              className="p-2 text-slate-500 hover:text-primary hover:bg-white rounded-md transition-colors tooltip-trigger"
                              title="Tạo lại"
                            >
                              <RotateCcw size={18} />
                            </button>
                            
                            <button 
                              onClick={() => handleDownload(scene)}
                              className="p-2 text-slate-500 hover:text-primary hover:bg-white rounded-md transition-colors"
                              title="Tải xuống"
                            >
                              <Download size={18} />
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {scene.audioData && (
                        <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium px-1">
                          <Check size={12} strokeWidth={3} />
                          Đã tạo xong ({(scene.audioData.byteLength / 1024).toFixed(1)} KB)
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default App;
