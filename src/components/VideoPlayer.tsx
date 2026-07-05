import { useEffect, useRef, useState } from "react";
import { Channel, AppSettings } from "@/types/iptv";
import { Card } from "@/components/ui/card";
import Hls from 'hls.js';
import { logger } from "@/utils/logger";
import { vertexShaderSource, fragmentShaderSource } from "./crtShader";

interface VideoPlayerProps {
  channel: Channel | null;
  settings: AppSettings;
  muted: boolean;
  isFullGuide: boolean;
  isFullGuideExpanded: boolean;
}

export const VideoPlayer = ({ channel, settings, muted, isFullGuide, isFullGuideExpanded }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadingVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const hlsRef = useRef<Hls>();
  const channelChangeTimeoutRef = useRef<NodeJS.Timeout>();
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isChannelChanging, setIsChannelChanging] = useState(false);
  const [mainVideoReady, setMainVideoReady] = useState(false);
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null);

  const setupWebGL = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    canvas.width = canvas.clientWidth || 640;
    canvas.height = canvas.clientHeight || 360;
    // compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compile error:', gl.getShaderInfoLog(vertexShader));
      return;
    }
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader compile error:', gl.getShaderInfoLog(fragmentShader));
      return;
    }
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);
    const inPos = gl.getAttribLocation(program, 'inPos');
    const u_texture = gl.getUniformLocation(program, 'u_texture');
    const u_distortion = gl.getUniformLocation(program, 'u_distortion');
    const u_stripe = gl.getUniformLocation(program, 'u_stripe');
    const u_rgbshift = gl.getUniformLocation(program, 'u_rgbshift');
    const u_vignette = gl.getUniformLocation(program, 'u_vignette');
    const u_vignette_radius = gl.getUniformLocation(program, 'u_vignette_radius');
    const u_edge_aberration = gl.getUniformLocation(program, 'u_edge_aberration');
    const u_frame_edge_blur = gl.getUniformLocation(program, 'u_frame_edge_blur');
    const u_center_sharpness = gl.getUniformLocation(program, 'u_center_sharpness');
    const u_sharpen_first = gl.getUniformLocation(program, 'u_sharpen_first');
    const u_resolution = gl.getUniformLocation(program, 'u_resolution');
    // buffer
    const bufRect = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufRect);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(inPos);
    gl.vertexAttribPointer(inPos, 2, gl.FLOAT, false, 0, 0);
    // texture
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // render
    const render = () => {
      let currentVideo = videoRef.current;

      // Priority: main video when ready > loading video during channel change > fallback to loading video
      if (mainVideoReady && videoRef.current && videoRef.current.readyState >= videoRef.current.HAVE_CURRENT_DATA) {
        currentVideo = videoRef.current;
      } else if (settings.showLoadingVideo && isChannelChanging &&
          loadingVideoRef.current && loadingVideoRef.current.readyState >= loadingVideoRef.current.HAVE_CURRENT_DATA) {
        currentVideo = loadingVideoRef.current;
      } else if (videoRef.current && videoRef.current.readyState >= videoRef.current.HAVE_CURRENT_DATA) {
        currentVideo = videoRef.current;
      } else if (loadingVideoRef.current && loadingVideoRef.current.readyState >= loadingVideoRef.current.HAVE_CURRENT_DATA) {
        currentVideo = loadingVideoRef.current;
      }

      if (currentVideo) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, currentVideo);
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1i(u_texture, 0);
      gl.uniform1f(u_distortion, 0.12);
      gl.uniform1f(u_stripe, 0.004);
      gl.uniform1f(u_rgbshift, settings.rgbShiftStrength);
      gl.uniform1f(u_vignette, settings.vignetteStrength);
      gl.uniform1f(u_vignette_radius, settings.vignetteRadius);
      gl.uniform1f(u_edge_aberration, settings.edgeAberration || 0);
      gl.uniform1f(u_frame_edge_blur, settings.frameEdgeBlur || 2);
      gl.uniform1f(u_center_sharpness, settings.centerSharpness || 0);
      gl.uniform1f(u_sharpen_first, settings.sharpenFirst ? 1.0 : 0.0);
      gl.uniform2f(u_resolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      animationRef.current = requestAnimationFrame(render);
    };
    render();
  };

  useEffect(() => {

    // Setup loading video
    if (loadingVideoRef.current) {
      loadingVideoRef.current.src = '/loading-VHS.mp4';
      loadingVideoRef.current.loop = true;
      loadingVideoRef.current.muted = true; // Start muted, unmute only during channel changes
      
      loadingVideoRef.current.addEventListener('loadeddata', () => {
        logger.log('Loading video loaded successfully');
      });
      
      loadingVideoRef.current.addEventListener('error', (e) => {
        console.error('VideoPlayer: Loading video ERROR:', e);
        logger.error(`Loading video failed to load: ${e}`);
      });
      
      loadingVideoRef.current.play()
        .then(() => {
          logger.log('Loading video started playing');
        })
        .catch(err => {
          console.error('Loading video play error:', err);
          logger.error(`Loading video play error: ${err}`);
        });
    }

    if (settings.vintageTV) {
      setupWebGL();
    }

    if (channel) {
      setCurrentChannelId(channel.id);

      // Always treat as channel change to ensure loading video shows
      // This ensures the 2-second minimum delay even for previously streamed channels
      setIsChannelChanging(true);
      setMainVideoReady(false); // Reset main video ready state
      setIsLoading(true);
      setIsBuffering(true);
      logger.log(`Channel changed to: ${channel.name}`);

      // Unmute loading video during channel changes
      if (loadingVideoRef.current) {
        loadingVideoRef.current.muted = false;
        loadingVideoRef.current.play()
          .catch(err => {
            console.error('Loading video restart error:', err);
            logger.error(`Loading video restart error: ${err}`);
          });
      }

      // Clear any existing timeout
      if (channelChangeTimeoutRef.current) {
        clearTimeout(channelChangeTimeoutRef.current);
      }

      // Set minimum 2-second delay for ALL channel loads
      channelChangeTimeoutRef.current = setTimeout(() => {
        setIsChannelChanging(false);
        setIsLoading(false);
      }, 2000);

      // Load main video
      if (videoRef.current) {
        const video = videoRef.current;

        // Ensure video is reset for channel changes
        video.pause();
        video.currentTime = 0;

        if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          logger.log(`Loaded stream URL for ${channel.name}: ${channel.url}`);
          hls.loadSource(channel.url);
          hls.attachMedia(video);

          // Add canplaythrough listener immediately after attachMedia
          video.addEventListener('canplaythrough', async () => {
            setMainVideoReady(true);
            // Setup audio effects after video can play through
            // if (settings.audioFilterEnabled) {
            //   await setupAudioEffects();
            // }
          }, { once: true });

          // Also add loadeddata listener as backup - fires when first frame is loaded
          video.addEventListener('loadeddata', async () => {
            // Only setup audio if not already set up
            // if (settings.audioFilterEnabled && !sourceNodeRef.current) {
            //   console.log('VideoPlayer: Setting up audio from loadeddata event');
            //   await setupAudioEffects();
            // }
          }, { once: true });

          // Reset ready state when video pauses
          video.addEventListener('pause', () => {
            setMainVideoReady(false);
          });

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            // Start playing and completely pause loading video when stream is ready
            video.play().catch(err => console.error('Play error:', err));
            if (loadingVideoRef.current) {
              loadingVideoRef.current.pause();
              loadingVideoRef.current.muted = true;
            }
            // Loading will be set to false by the timeout (always 2 seconds minimum)
            
            // Additional check: if audio filter is enabled and audio isn't set up yet, try to set it up
            setTimeout(async () => {
              // if (settings.audioFilterEnabled && !sourceNodeRef.current && video.readyState >= video.HAVE_CURRENT_DATA) {
              //   console.log('VideoPlayer: Setting up audio from MANIFEST_PARSED timeout');
              //   await setupAudioEffects();
              // }
            }, 500);
          });

          hls.on(Hls.Events.BUFFER_APPENDED, () => {
            setIsBuffering(false);
          });

          hls.on(Hls.Events.BUFFER_EOS, () => {
            setIsBuffering(false);
          });

          hls.on(Hls.Events.BUFFER_FLUSHING, () => {
            // For channel changes, we ignore buffering events during the loading phase
            // Buffering state is managed by the timeout
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS Error:', data);
            if (data.fatal) {
              setIsBuffering(true);
              setMainVideoReady(false); // Reset ready state on error
              // Try to recover
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  hls.recoverMediaError();
                  break;
                default:
                  hls.destroy();
                  break;
              }
            }
          });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          logger.log(`Loaded stream URL for ${channel.name}: ${channel.url}`);
          video.src = channel.url;

          // Add canplaythrough listener immediately after setting src
          video.addEventListener('canplaythrough', async () => {
            setMainVideoReady(true);
            // Setup audio effects after video can play through
            // if (settings.audioFilterEnabled) {
            //   await setupAudioEffects();
            // }
          }, { once: true });

          // Also add loadeddata listener as backup
          video.addEventListener('loadeddata', async () => {
            // if (settings.audioFilterEnabled && !sourceNodeRef.current) {
            //   console.log('VideoPlayer: Setting up audio from loadeddata event');
            //   await setupAudioEffects();
            // }
          }, { once: true });

          // Reset ready state when video pauses
          video.addEventListener('pause', () => {
            setMainVideoReady(false);
          });

          video.addEventListener('loadedmetadata', () => {
            // Start playing and completely pause loading video when stream is ready
            video.play().catch(err => console.error('Play error:', err));
            if (loadingVideoRef.current) {
              loadingVideoRef.current.pause();
              loadingVideoRef.current.muted = true;
            }
            // Loading will be set to false by the timeout (always 2 seconds minimum)
            
            // Additional check for audio setup
            setTimeout(async () => {
              // if (settings.audioFilterEnabled && !sourceNodeRef.current && video.readyState >= video.HAVE_CURRENT_DATA) {
              //   console.log('VideoPlayer: Setting up audio from loadedmetadata timeout (native HLS)');
              //   await setupAudioEffects();
              // }
            }, 500);
          });
          // For channel changes, buffering is managed by the timeout
        } else {
          logger.log(`Loaded stream URL for ${channel.name}: ${channel.url.replace('.m3u8', '.mp4')}`);
          video.src = channel.url.replace('.m3u8', '.mp4');

          // Add canplaythrough listener immediately after setting src
          video.addEventListener('canplaythrough', async () => {
            setMainVideoReady(true);
            // Setup audio effects after video can play through
            // if (settings.audioFilterEnabled) {
            //   await setupAudioEffects();
            // }
          }, { once: true });

          // Also add loadeddata listener as backup
          video.addEventListener('loadeddata', async () => {
            // if (settings.audioFilterEnabled && !sourceNodeRef.current) {
            //   console.log('VideoPlayer: Setting up audio from loadeddata event');
            //   await setupAudioEffects();
            // }
          }, { once: true });

          // Reset ready state when video pauses
          video.addEventListener('pause', () => {
            setMainVideoReady(false);
          });

          video.addEventListener('loadedmetadata', () => {
            // Start playing and completely pause loading video when stream is ready
            video.play().catch(err => console.error('Play error:', err));
            if (loadingVideoRef.current) {
              loadingVideoRef.current.pause();
              loadingVideoRef.current.muted = true;
            }
            // Loading will be set to false by the timeout (always 2 seconds minimum)
            
            // Additional check for audio setup
            setTimeout(async () => {
              // if (settings.audioFilterEnabled && !sourceNodeRef.current && video.readyState >= video.HAVE_CURRENT_DATA) {
              //   console.log('VideoPlayer: Setting up audio from loadedmetadata timeout (MP4)');
              //   await setupAudioEffects();
              // }
            }, 500);
          });
          // For channel changes, buffering is managed by the timeout
        }
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      if (channelChangeTimeoutRef.current) {
        clearTimeout(channelChangeTimeoutRef.current);
      }
    };
  }, [channel, settings.vintageTV, settings.vignetteStrength, settings.rgbShiftStrength, settings.vignetteRadius, settings.showLoadingVideo]);

  // Handle video player resizing
  useEffect(() => {
    if (settings.vintageTV && canvasRef.current) {
      // Re-setup WebGL with new canvas dimensions when size changes
      setupWebGL();
    }
  }, [isFullGuide, isFullGuideExpanded, settings.vintageTV]);


  if (!channel) {
    return (
      <Card className={`aspect-video w-full flex items-center justify-center bg-gradient-card ${settings.panelStyle === 'shadow' ? 'border-none shadow-lg' : 'border-border'}`}>
        <p className="text-muted-foreground text-lg">Select a channel to start watching</p>
      </Card>
    );
  }

  return (
    <Card className={`${isFullGuide ? 'h-[35vh]' : 'aspect-video'} w-full overflow-hidden bg-black rounded-3xl ${settings.panelStyle === 'shadow' ? 'border-none shadow-lg' : 'border-border shadow-glow'}`} style={isFullGuide ? (isFullGuideExpanded ? { height: '100vh', width: 'calc(100vh * 16 / 9)', margin: '0 auto', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5), 0 0 30px hsl(215.4 25% 26.7% / 0.3)' } : { height: '35vh', width: 'calc(35vh * 16 / 9)', marginLeft: 'auto', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5), 0 0 30px hsl(215.4 25% 26.7% / 0.3)' }) : { boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5), 0 0 30px hsl(215.4 25% 26.7% / 0.3)', maxHeight: 'calc(100vh - 50px)' }}>
      {settings.vintageTV ? (
        <>
          <video
            ref={videoRef}
            style={{ display: 'none' }}
            autoPlay
            muted={muted}
            playsInline
          >
            <source src={channel.url} type="application/x-mpegURL" />
            <source src={channel.url} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <video
            ref={loadingVideoRef}
            style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
            autoPlay
            muted
            loop
            playsInline
          >
            <source src="/loading-VHS.mp4" type="video/mp4" />
          </video>
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            onClick={() => videoRef.current?.play()}
          />
        </>
      ) : (
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          controls
          autoPlay
          muted={muted}
          playsInline
        >
          <source src={channel.url} type="application/x-mpegURL" />
          <source src={channel.url} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      )}
    </Card>
  );
};
