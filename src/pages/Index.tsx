import { useState, useEffect, useRef, useCallback } from "react";
import { Channel, EPGData, Program, AppSettings } from "@/types/iptv";
import { parseM3U } from "@/utils/m3uParser";
import { parseXMLTV } from "@/utils/xmltvParser";
import { loadFromUrl } from "@/utils/urlLoader";
import { formatChannelName, getChannelCategory } from "@/utils/channelFormat";
import { getCurrentProgram as getCurrentProgramFromList } from "@/utils/epg";
import { CategoryIcon } from "@/components/CategoryIcon";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ChannelList } from "@/components/ChannelList";
import { EPGView } from "@/components/EPGView";
import { FileUploader } from "@/components/FileUploader";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Poster } from "@/components/Poster";
import { ClockDisplay } from "@/components/ClockDisplay";
import { FullGuide } from "@/components/FullGuide/FullGuide";
import { useSettings } from "@/hooks/useSettings";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useQueuedToast } from "@/hooks/useQueuedToast";
import { useIdleState } from "@/hooks/useIdleState";
import { logger } from "@/utils/logger";
import { Button } from "@/components/ui/button";
import { Settings, Maximize, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

const Index = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [epgData, setEpgData] = useState<EPGData>({});
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { settings, updateSettings, isFirstRun } = useSettings();
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const pausedChannelRef = useRef<Channel | null>(null);

  // Automatic EPG updates every 4 hours using current input field values
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only start auto-updates if we have URLs configured (either saved or in input fields)
    const hasUrls = (settings.m3uUrl || settings.xmltvUrl) || (localSettings.m3uUrl || localSettings.xmltvUrl);
    
    if (!hasUrls) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      // Use current input field values for auto-updates
      loadFromUrlsFromInputs(true); // Silent reload
    }, 4 * 60 * 60 * 1000); // 4 hours

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [settings.m3uUrl, settings.xmltvUrl, localSettings.m3uUrl, localSettings.xmltvUrl]);

  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Load URLs when settings are first loaded and contain URLs (on initial page load)
  useEffect(() => {
    if (settings.m3uUrl || settings.xmltvUrl) {
      // Save settings globally (like closing settings panel does)
      updateSettings(settings);
      // Update local settings to match
      setLocalSettings(settings);
      // Load channels and EPG using the loaded settings
      loadFromUrlsFromInputs(true, settings).then(() => {
        setInitialLoadComplete(true);
      });
    }
  }, [settings.m3uUrl, settings.xmltvUrl]);

  // Show sequential notifications after initial load completes
  useEffect(() => {
    if (initialLoadComplete && settings.showNotifications) {
      // 1. Channels loaded
      queueNotification(() => toast.success(`Loaded: ${channels.length} Channels`), `Loaded: ${channels.length} Channels`);

      // 2. Current channel (after 2 seconds)
      setTimeout(() => {
        if (selectedChannel) {
          toast.info(
            <span className="flex items-center gap-2">
              Now Playing: {formatChannelName(selectedChannel.name)}{' '}
              <CategoryIcon
                category={getChannelCategory(selectedChannel.name, selectedChannel.group)}
                className="w-4 h-4 inline-block"
              />
            </span>
          );
        }
      }, 2000);

      // 3. EPG programs count (after 4 seconds)
      setTimeout(() => {
        const totalPrograms = Object.values(epgData).reduce((sum, programs) => sum + programs.length, 0);
        toast.success(`Loaded: EPG Data for ${totalPrograms} Programs`);
        setInitialLoadComplete(false); // Reset for next load
        initialNotificationSequenceCompleteRef.current = true; // Allow manual channel change notifications
      }, 4000);
    }
  }, [initialLoadComplete, channels.length, selectedChannel, epgData, settings.showNotifications]);

  // Helper function to get panel classes based on style setting
  const getPanelClasses = (baseClasses: string = '') => {
    if (settings.panelStyle === 'shadow') {
      // Shadow style: no border, use shadow and slightly darker background
      return `bg-card/95 shadow-lg ${baseClasses}`;
    }
    // Bordered style (default)
    return `bg-card border border-border ${baseClasses}`;
  };

  // Helper function for sidebar panels (darker in shadow mode)
  const getSidebarPanelClasses = (baseClasses: string = '') => {
    if (settings.panelStyle === 'shadow') {
      // Shadow style: lighter background similar to outline button
      return `bg-secondary/50 shadow-lg ${baseClasses}`;
    }
    // Bordered style (default)
    return `bg-card border border-border ${baseClasses}`;
  };

  const handleSettingsToggle = () => {
    if (settingsOpen) {
      // Save settings and load URLs
      updateSettings(localSettings);
      loadFromUrlsFromInputs(false); // Load with notifications
      setSettingsOpen(false);
    } else {
      // Close poster if open, then open settings
      setSelectedPoster(null);
      setLocalSettings(settings);
      setSettingsOpen(true);
    }
  };
  const [muted, setMuted] = useState(false);
  const [fullGuideOpen, setFullGuideOpen] = useState(false);
  const [focusedProgram, setFocusedProgram] = useState<{program: Program, channel: Channel} | null>(null);
  const lastColors = useRef(new Map<string, string>());

  const [fullGuideExpanded, setFullGuideExpanded] = useState(false);

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('tvx-favorites');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const [isLoading, setIsLoading] = useState(false);
  const channelListRef = useRef<HTMLDivElement>(null);
  const epgViewRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const fullGuideRef = useRef<HTMLDivElement>(null);
  const mainTimelineRef = useRef<HTMLDivElement>(null);
  const selectedChannelRowRef = useRef<HTMLDivElement>(null);

  // Track if this is the initial load to prevent notification spam
  const isInitialLoadRef = useRef(true);
  const hasShownInitialChannelRef = useRef(false);
  // Track if we're currently doing a resync channel switch
  const isResyncingRef = useRef(false);
  // Track if initial notification sequence has completed
  const initialNotificationSequenceCompleteRef = useRef(false);
  
  const [theaterMode, setTheaterMode] = useState(false); // Track if user clicked video to hide everything
  const [activeTab, setActiveTab] = useState('guide');
  const [statsOpen, setStatsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [guideResetKey, setGuideResetKey] = useState(0);

  const [selectedPoster, setSelectedPoster] = useState<Program | null>(null);
  const [currentProgram, setCurrentProgram] = useState<Program | null>(null);

  // Idle detection, scroll tracking and sidebar visibility. Extracted to a shared hook.
  const { isIdle, setIsIdle, sidebarVisible, setSidebarVisible } = useIdleState({
    theaterMode,
    settingsOpen,
    fullGuideOpen,
    focusedProgram,
    selectedPoster,
    scrollRefs: [channelListRef, epgViewRef, settingsRef, fullGuideRef],
    closePoster: () => setSelectedPoster(null),
  });

  // Notification queue (2s spacing + 5s de-dupe). Extracted to a shared hook.
  const { queuedToast, queueNotification } = useQueuedToast();

  const handleClosePoster = useCallback(() => {
    logger.info('Closed: Poster');
    setSelectedPoster(null);
  }, []);

  const handlePosterToggle = useCallback((program: Program | null) => {
    if (program) {
      logger.info(`Opened: Poster for "${program.title}"`);
    } else {
      logger.info('Closed: Poster');
    }
    setSelectedPoster(program);
  }, []);

  const getCurrentProgram = (channel: Channel | null): Program | null =>
    channel ? getCurrentProgramFromList(epgData[channel.id] || []) : null;

  useEffect(() => {
    const program = getCurrentProgram(selectedChannel);
    setCurrentProgram(program);
    
    // If poster is open, update it to show the current program of the new channel
    if (selectedPoster && program && (program.image || program.icon)) {
      setSelectedPoster(program);
    }

    // If focused program popup is open in full guide, update it to show current program of new channel
    if (fullGuideOpen && focusedProgram && selectedChannel && program) {
      setFocusedProgram({ program, channel: selectedChannel });
    }

    // Save selected channel to localStorage and show notification
    if (selectedChannel) {
      // Save the actual current channel (no offset needed since we handle AudioContext properly)
      localStorage.setItem('last-watched-channel', selectedChannel.id);
      console.log(`Index: Saving current channel ${selectedChannel.name} (${selectedChannel.id}) to localStorage`);
      
      // Only show notification if:
      // 1. Channels are loaded
      // 2. Not the initial load (first channel selection on page load)
      // 3. Initial notification sequence has completed (to avoid duplicates with sequential notifications)
      const shouldShowNotification = channels.length > 0 && !isInitialLoadRef.current && initialNotificationSequenceCompleteRef.current;
      
      if (shouldShowNotification && settings.showNotifications) {
        // Use the same formatting as the initial load notification
        queuedToast.info(
          <span className="flex items-center gap-2">
            Now Playing: {formatChannelName(selectedChannel.name)}{' '}
            <CategoryIcon
              category={getChannelCategory(selectedChannel.name, selectedChannel.group)}
              className="w-4 h-4 inline-block"
            />
          </span>
        );
      }
      
      // Mark that initial channel has been set
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        hasShownInitialChannelRef.current = true;
      }

      // No longer need the simulated key press since we save the correct channel
    }
  }, [selectedChannel, epgData, channels.length, settings.showNotifications]);

  useEffect(() => {
    if (currentProgram) {
      // Reset idle when program changes
      setIsIdle(false);
      setSidebarVisible(true);
    }
  }, [currentProgram]);

  useEffect(() => {
    // Reset idle timer when popup/poster is opened
    if (focusedProgram || selectedPoster) {
      setIsIdle(false);
      setSidebarVisible(true);
    }
  }, [focusedProgram, selectedPoster]);

  const handleM3ULoad = (content: string, silent = false) => {
    try {
      const parsedChannels = parseM3U(content);
      setChannels(parsedChannels);
      
      // Try to restore last watched channel
      const lastWatchedId = localStorage.getItem('last-watched-channel');
      console.log('Index: Loading from localStorage - last-watched-channel:', lastWatchedId);
      let channelToSelect = null;
      
      if (lastWatchedId) {
        channelToSelect = parsedChannels.find(ch => ch.id === lastWatchedId);
        console.log('Index: Found matching channel:', channelToSelect?.name, channelToSelect?.id);
      }
      
      // If no last watched or channel not found, use first channel
      if (!channelToSelect && parsedChannels.length > 0) {
        channelToSelect = parsedChannels[0];
        console.log('Index: No saved channel found, using first channel:', channelToSelect.name);
      }
      
      if (channelToSelect) {
        // On page refresh, we need to ensure AudioContext is resumed before loading the channel
        // This is crucial for audio filters to work properly
        const resumeAudioAndLoadChannel = async () => {
          try {
            // Try to resume AudioContext immediately (may fail without user gesture)
            const audioContext = new ((window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)!)();
            if (audioContext.state === 'suspended') {
              console.log('Index: AudioContext suspended on page load, will resume on user interaction');
            } else {
              console.log('Index: AudioContext running on page load');
            }
          } catch (error) {
            console.error('Index: Error checking AudioContext on page load:', error);
          }
          
          setSelectedChannel(channelToSelect);
        };
        
        resumeAudioAndLoadChannel();
      }      // Only show notification if not silent mode and notifications are enabled
      if (!silent && settings.showNotifications) {
        queuedToast.success(`Loaded: ${parsedChannels.length} Channels`);
      }
    } catch (error) {
      logger.error('Error: Failed to Parse M3U File');
      toast.error('Error: Failed to Parse M3U File');
      console.error(error);
    }
  };

  const handleXMLTVLoad = (content: string, silent = false) => {
    try {
      const parsedEPG = parseXMLTV(content);
      setEpgData(parsedEPG);
      const programCount = Object.values(parsedEPG).reduce((sum, progs) => sum + progs.length, 0);
      
      // Only show notification if not silent mode and notifications are enabled
      if (!silent && settings.showNotifications) {
        queuedToast.success(`Loaded: EPG Data for ${programCount} Programs`);
      }
    } catch (error) {
      logger.error('Error: Failed to Parse XMLTV File');
      toast.error('Error: Failed to Parse XMLTV File');
      console.error(error);
    }
  };

  const loadFromUrlsFromInputs = async (silent = false, overrideSettings?: AppSettings): Promise<void> => {
    const currentSettings = overrideSettings || localSettings;
    const currentM3uUrl = currentSettings.m3uUrl || settings.m3uUrl;
    const currentXmltvUrl = currentSettings.xmltvUrl || settings.xmltvUrl;

    if (!currentM3uUrl && !currentXmltvUrl) {
      if (!silent) {
        queuedToast.error('Error: Please Configure URLs in Settings First');
      }
      return;
    }

    setIsLoading(true);

    try {
      if (currentM3uUrl) {
        try {
          const m3uContent = await loadFromUrl(currentM3uUrl);
          handleM3ULoad(m3uContent, silent);
        } catch (error) {
          console.error('Failed to load M3U:', error);
          if (!silent && settings.showNotifications) {
            queuedToast.error(`Error: Failed to Load M3U from ${currentM3uUrl}`);
          }
        }
      }

      if (currentXmltvUrl) {
        try {
          const xmltvContent = await loadFromUrl(currentXmltvUrl);
          handleXMLTVLoad(xmltvContent, silent);
        } catch (error) {
          console.error('Failed to load XMLTV:', error);
          if (!silent && settings.showNotifications) {
            queuedToast.error(`Error: Failed to Load XMLTV from ${currentXmltvUrl}`);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (fullGuideOpen) {
      let expansionTimer: NodeJS.Timeout;
      
      const resetExpansionTimer = () => {
        clearTimeout(expansionTimer);
        const expansionTime = focusedProgram ? 25000 : 10000; // 25s with popup, 10s without
        expansionTimer = setTimeout(() => {
          // Close full guide after idle timeout so video player can resize properly
          setFullGuideOpen(false);
          setFullGuideExpanded(false);
          // Keep sidebar visible when guide closes
          setSidebarVisible(true);
        }, expansionTime);
      };

      // Listen for user activity to reset the expansion timer
      const handleActivity = () => {
        resetExpansionTimer();
      };

      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('touchstart', handleActivity);
      window.addEventListener('click', handleActivity);
      window.addEventListener('wheel', handleActivity);
      
      resetExpansionTimer(); // Start initial timer

      return () => {
        clearTimeout(expansionTimer);
        window.removeEventListener('mousemove', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('touchstart', handleActivity);
        window.removeEventListener('click', handleActivity);
        window.removeEventListener('wheel', handleActivity);
      };
    } else {
      setFullGuideExpanded(false);
      setSidebarVisible(true);
    }
  }, [fullGuideOpen, focusedProgram]);

  // Show sidebar when poster is selected in full guide
  useEffect(() => {
    if (selectedPoster && fullGuideOpen) {
      setSidebarVisible(true);
    }
  }, [selectedPoster, fullGuideOpen]);

  // Auto-scroll main timeline to show current time
  useEffect(() => {
    if (fullGuideOpen && fullGuideExpanded && mainTimelineRef.current) {
      const now = new Date();
      const baseTime = new Date(now);
      baseTime.setMinutes(0, 0, 0);
      baseTime.setHours(baseTime.getHours() - 1);
      const minutesFromBase = (now.getTime() - baseTime.getTime()) / 1000 / 60;
      const currentTimePosition = minutesFromBase * 4; // 4px per minute
      // Scroll to position where current time is visible, with some padding to the left
      mainTimelineRef.current.scrollLeft = Math.max(0, currentTimePosition - 200);
    }
  }, [fullGuideOpen, fullGuideExpanded]);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (fullGuideExpanded) {
      const handleMouseMove = () => {
        setFullGuideExpanded(false);
        setSidebarVisible(true);
      };

      const handleScroll = () => {
        setFullGuideExpanded(false);
        setSidebarVisible(true);
      };

      window.addEventListener('mousemove', handleMouseMove);

      // Also listen for scroll events on the full guide
      const fullGuideElement = fullGuideRef.current;
      if (fullGuideElement) {
        fullGuideElement.addEventListener('scroll', handleScroll, { passive: true });
        // Also listen on child scrollable elements
        const scrollableChildren = fullGuideElement.querySelectorAll('[data-radix-scroll-area-viewport], .overflow-auto, .overflow-x-auto, .overflow-y-auto');
        scrollableChildren.forEach((element) => {
          element.addEventListener('scroll', handleScroll, { passive: true });
        });
      }

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        if (fullGuideElement) {
          fullGuideElement.removeEventListener('scroll', handleScroll);
          const scrollableChildren = fullGuideElement.querySelectorAll('[data-radix-scroll-area-viewport], .overflow-auto, .overflow-x-auto, .overflow-y-auto');
          scrollableChildren.forEach((element) => {
            element.removeEventListener('scroll', handleScroll);
          });
        }
      };
    }
  }, [fullGuideExpanded]);

  useKeyboardShortcuts({
    onSettings: () => {
      logger.info(settingsOpen ? 'Closed: Settings' : 'Opened: Settings');
      if (settingsOpen) {
        setSettingsOpen(false);
      } else {
        // Exit theater mode and full guide if open, then show settings
        setTheaterMode(false);
        setFullGuideOpen(false);
        setSelectedPoster(null);
        setSettingsOpen(true);
      }
    },
    onFullscreen: () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        logger.info('Entered: Fullscreen Mode (Keyboard)');
      } else {
        document.exitFullscreen();
        logger.info('Exited: Fullscreen Mode (Keyboard)');
      }
    },
    onToggleGuide: () => {
      logger.info(fullGuideOpen ? 'Closed: Full TV Guide (Keyboard)' : 'Opened: Full TV Guide (Keyboard)');
      setTheaterMode(false);
      const wasOpen = fullGuideOpen;
      setFullGuideOpen(!fullGuideOpen);
      if (wasOpen) {
        setSelectedPoster(null);
      } else {
        // Auto-open popup for currently playing program when opening guide
        if (selectedChannel) {
          const now = new Date();
          const currentProgram = (epgData[selectedChannel.id] || []).find(
            p => p.start <= now && p.end > now
          );
          if (currentProgram) {
            setFocusedProgram({ program: currentProgram, channel: selectedChannel });
          }
        }
      }
      queuedToast.info(wasOpen ? 'Closed: Full TV Guide' : 'Opened: Full TV Guide');
    },
    onToggleStats: () => {
      logger.info(statsOpen ? 'Closed: Stats (Keyboard)' : 'Opened: Stats (Keyboard)');
      setTheaterMode(false);
      setStatsOpen(!statsOpen);
      queuedToast.info(statsOpen ? 'Closed: Stats' : 'Opened: Stats');
    },
    onToggleMute: () => {
      logger.info(!muted ? 'Muted: Audio (Keyboard)' : 'Unmuted: Audio (Keyboard)');
      setMuted(!muted);
      queuedToast.info(!muted ? 'Muted: Audio' : 'Unmuted: Audio');
    },
    onPlayPause: () => {
      if (selectedChannel) {
        // Stop/Pause - store current channel and set to null
        pausedChannelRef.current = selectedChannel;
        setSelectedChannel(null);
        logger.info('Video: Stopped (Keyboard)');
        queuedToast.info('Video: Stopped');
      } else if (pausedChannelRef.current) {
        // Play/Resume - restore the paused channel
        setSelectedChannel(pausedChannelRef.current);
        logger.info('Video: Playing (Keyboard)');
        queuedToast.info('Video: Playing');
      }
    },
    // onToggleAudioFilter: () => {
    //   const newState = !settings.audioFilterEnabled;
    //   updateSettings({ audioFilterEnabled: newState });
    //   toast.info(newState ? 'Enabled: Vintage Audio Filter' : 'Disabled: Vintage Audio Filter');
    // },
  });

  const toggleFavorite = (program: Program) => {
    const key = `${program.title}-${program.start.getTime()}`;
    setFavorites(prev => {
      const newFav = new Set(prev);
      if (newFav.has(key)) {
        newFav.delete(key);
        logger.info(`Removed: Favorite "${program.title}"`);
      } else {
        newFav.add(key);
        logger.info(`Added: Favorite "${program.title}"`);
      }
      localStorage.setItem('tvx-favorites', JSON.stringify([...newFav]));
      return newFav;
    });
  };

  const currentPrograms = selectedChannel ? epgData[selectedChannel.id] || [] : [];

  // Scroll selected channel into view in full guide
  useEffect(() => {
    if (fullGuideOpen && !focusedProgram && selectedChannelRowRef.current) {
      selectedChannelRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedChannel, fullGuideOpen, focusedProgram]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIndex = channels.findIndex(c => c.id === selectedChannel?.id);
        if (currentIndex > 0) {
          setSelectedChannel(channels[currentIndex - 1]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const currentIndex = channels.findIndex(c => c.id === selectedChannel?.id);
        if (currentIndex >= 0) {
          // Cycle to next channel, wrapping around to first channel
          const nextIndex = (currentIndex + 1) % channels.length;
          setSelectedChannel(channels[nextIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [channels, selectedChannel]);

  const handleVideoPlayerClick = () => {
    // 3-state cycle: Full TV Guide → Normal View → Theater Mode → Full TV Guide
    
    if (fullGuideOpen) {
      // State 1: Full TV Guide is open → Go to Normal View
      logger.info('Switched: Normal View (from Full TV Guide)');
      setFullGuideOpen(false);
      setFullGuideExpanded(false);
      setFocusedProgram(null);
      setSelectedPoster(null);
      setTheaterMode(false);
      setIsIdle(false);
      setSidebarVisible(true);
      setActiveTab('guide'); // Show EPG panels
      
    } else if (!theaterMode && sidebarVisible) {
      // State 2: Normal View (sidebar + EPG visible) → Go to Theater Mode
      logger.info('Switched: Theater Mode');
      setTheaterMode(true);
      setIsIdle(true);
      setSidebarVisible(false);
      setSettingsOpen(false);
      
    } else {
      // State 3: Theater Mode → Go to Full TV Guide
      logger.info('Switched: Full TV Guide');
      setTheaterMode(false);
      setFullGuideOpen(true);
      setIsIdle(false);
      setSidebarVisible(true);
      // Auto-open popup for currently playing program
      if (selectedChannel) {
        const now = new Date();
        const currentProgram = (epgData[selectedChannel.id] || []).find(
          p => p.start <= now && p.end > now
        );
        if (currentProgram) {
          setFocusedProgram({ program: currentProgram, channel: selectedChannel });
        }
      }
    }
  };

  return (
    <div className={`h-screen grid overflow-hidden ${sidebarVisible ? 'lg:grid-cols-[75%_25%]' : 'grid-cols-[1fr]'} ${settings.panelStyle === 'shadow' ? 'bg-slate-950' : 'bg-background'}`}>
      <main className={`space-y-6 h-full ${sidebarVisible ? 'pt-4 pl-4' : 'p-[30px]'}`}>
        <div onClick={handleVideoPlayerClick} className={`cursor-pointer ${fullGuideOpen ? 'flex justify-end' : ''}`}>
          <VideoPlayer channel={selectedChannel} settings={settings} muted={muted} isFullGuide={fullGuideOpen} isFullGuideExpanded={fullGuideExpanded} />
        </div>
        
        {selectedChannel && !fullGuideOpen && activeTab === 'guide' && (
          <div ref={epgViewRef}>
            <EPGView key={selectedChannel.id} programs={currentPrograms} channelName={selectedChannel.name} isIdle={isIdle} onPosterClick={handlePosterToggle} selectedPoster={selectedPoster} panelStyle={settings.panelStyle} favorites={favorites} toggleFavorite={toggleFavorite} />
          </div>
        )}
        
        {selectedChannel && fullGuideOpen && !fullGuideExpanded && (
          <FullGuide
            key={guideResetKey}
            channels={channels}
            epgData={epgData}
            selectedChannel={selectedChannel}
            focusedProgram={focusedProgram}
            favorites={favorites}
            currentTime={currentTime}
            panelStyle={settings.panelStyle}
            fullGuideRef={fullGuideRef}
            mainTimelineRef={mainTimelineRef}
            selectedRowRef={selectedChannelRowRef}
            setSelectedChannel={setSelectedChannel}
            setSelectedPoster={setSelectedPoster}
            setFocusedProgram={setFocusedProgram}
            toggleFavorite={toggleFavorite}
            onRefresh={() => {
              loadFromUrlsFromInputs(true);
              setGuideResetKey(prev => prev + 1);
            }}
            onCloseGuide={() => {
              logger.info('Closed: Full TV Guide');
              setFullGuideOpen(false);
              setSelectedPoster(null);
            }}
          />
        )}
      </main>
      {sidebarVisible && (
        <aside className={`flex flex-col h-full gap-4 p-4 transition-opacity duration-3000 ${isIdle ? 'opacity-5' : 'opacity-100'}`}>
          <div className={`${getSidebarPanelClasses('rounded-lg')} transition-opacity duration-1000 ${isIdle ? 'opacity-5' : 'opacity-100'}`}>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold">TVx</h1>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="scale-125">
                  <ClockDisplay time={currentTime} style={settings.clockStyle} />
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen();
                      logger.info('Entered: Fullscreen Mode');
                    } else {
                      document.exitFullscreen();
                      logger.info('Exited: Fullscreen Mode');
                    }
                    queuedToast.info(!document.fullscreenElement ? 'Entered: Fullscreen Mode' : 'Exited: Fullscreen Mode');
                  }}
                  className="hover:bg-secondary"
                  title="Fullscreen"
                >
                  <Maximize className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const newMutedState = !muted;
                    setMuted(newMutedState);
                    queuedToast.info(newMutedState ? 'Muted: Audio' : 'Unmuted: Audio');
                  }}
                  className="hover:bg-secondary"
                  title={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSettingsToggle}
                  className="hover:bg-secondary"
                  title={settingsOpen ? "Save Settings (Ctrl/Cmd + ,)" : "Settings (Ctrl/Cmd + ,)"}
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
          {!fullGuideOpen && (
            <Button
              variant="outline"
              onClick={() => {
                setTheaterMode(false);
                setFullGuideOpen(true);
                // Auto-open popup for currently playing program
                if (selectedChannel) {
                  const now = new Date();
                  const currentProgram = (epgData[selectedChannel.id] || []).find(
                    p => p.start <= now && p.end > now
                  );
                  if (currentProgram) {
                    setFocusedProgram({ program: currentProgram, channel: selectedChannel });
                  }
                }
                queuedToast.info('Opened: Full TV Guide');
              }}
              className={`w-full ${settings.panelStyle === 'shadow' ? 'border-none shadow-md hover:shadow-lg' : ''}`}
            >
              Full TV Guide
            </Button>
          )}
          {fullGuideOpen && (
            <Button
              variant="outline"
              onClick={() => { 
                setActiveTab('guide'); 
                setFullGuideOpen(false);
                queuedToast.info('Opened: Channel Guide');
              }}
              className={`w-full ${settings.panelStyle === 'shadow' ? 'border-none shadow-md hover:shadow-lg' : ''}`}
            >
              Channel Guide
            </Button>
          )}
          <div className={`${getSidebarPanelClasses('rounded-lg relative max-h-[500px]')}`}>
            {selectedPoster && !focusedProgram ? (
              <Poster program={selectedPoster} onClose={handleClosePoster} isIdle={isIdle} />
            ) : settingsOpen ? (
              <div ref={settingsRef}>
                <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={localSettings} onSave={setLocalSettings} onGlobalSave={updateSettings} onLoad={() => loadFromUrlsFromInputs(false)} inline />
              </div>
            ) : (
              <div ref={channelListRef} className="h-full overflow-y-auto">
                <ChannelList
                  channels={channels}
                  selectedChannel={selectedChannel}
                  panelStyle={settings.panelStyle}
                  onSelectChannel={(channel) => {
                    logger.info(`Selected: Channel "${channel.name}" in Sidebar`);
                    setSelectedChannel(channel);
                    // Show poster for current program when in full guide
                    if (fullGuideOpen) {
                      const currentProg = getCurrentProgram(channel);
                      if (currentProg && (currentProg.image || currentProg.icon)) {
                        setSelectedPoster(currentProg);
                      }
                      // Update focused program popup to show current program
                      if (currentProg) {
                        setFocusedProgram({ program: currentProg, channel });
                      }
                    }
                  }}
                />
              </div>
            )}
          </div>
          {selectedChannel && !statsOpen && (
            <Button
              variant="outline"
              onClick={() => {
                logger.info(statsOpen ? 'Closed: Stats' : 'Opened: Stats');
                setStatsOpen(true);
              }}
              className={`w-full ${settings.panelStyle === 'shadow' ? 'border-none shadow-md hover:shadow-lg' : ''}`}
            >
              Stats
            </Button>
          )}
          {selectedChannel && statsOpen && (
            <div className={`${getSidebarPanelClasses('rounded-lg relative')}`}>
              <div className="p-3 pr-8">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    logger.info('Closed: Stats');
                    setStatsOpen(false);
                  }}
                  className="absolute top-1 right-1 h-5 w-5 hover:bg-secondary"
                >
                  <X className="w-3 h-3" />
                </Button>
                <div 
                  className="font-mono text-[10px] cursor-pointer hover:text-primary break-all" 
                  onClick={() => {
                    navigator.clipboard.writeText(selectedChannel.url);
                    queuedToast.success('Copied: Stream URL');
                  }}
                  title="Click to copy URL"
                >
                  {selectedChannel.url}
                </div>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
};

export default Index;
