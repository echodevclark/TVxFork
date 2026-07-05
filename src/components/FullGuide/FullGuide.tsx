import { RefObject } from "react";
import { Channel, EPGData, Program } from "@/types/iptv";
import { Clock, Calendar, RotateCw, X } from "lucide-react";
import { formatTime } from "@/utils/time";
import { getCurrentProgram } from "@/utils/epg";
import { logger } from "@/utils/logger";
import { ProgramPopup, FocusedProgram } from "./ProgramPopup";
import { GuideChannelColumn } from "./GuideChannelColumn";
import { GuideProgramGrid } from "./GuideProgramGrid";

interface FullGuideProps {
  channels: Channel[];
  epgData: EPGData;
  selectedChannel: Channel | null;
  focusedProgram: FocusedProgram | null;
  favorites: Set<string>;
  currentTime: Date;
  panelStyle: 'bordered' | 'shadow';
  fullGuideRef: RefObject<HTMLDivElement | null>;
  mainTimelineRef: RefObject<HTMLDivElement | null>;
  selectedRowRef: RefObject<HTMLDivElement | null>;
  setSelectedChannel: (channel: Channel) => void;
  setSelectedPoster: (program: Program | null) => void;
  setFocusedProgram: (focused: FocusedProgram | null) => void;
  toggleFavorite: (program: Program) => void;
  onRefresh: () => void;
  onCloseGuide: () => void;
}

// The full 12/24-hour TV guide overlay: header, optional focused-program popup, and the grid.
export const FullGuide = ({
  channels,
  epgData,
  selectedChannel,
  focusedProgram,
  favorites,
  currentTime,
  panelStyle,
  fullGuideRef,
  mainTimelineRef,
  selectedRowRef,
  setSelectedChannel,
  setSelectedPoster,
  setFocusedProgram,
  toggleFavorite,
  onRefresh,
  onCloseGuide,
}: FullGuideProps) => {
  const isShadow = panelStyle === 'shadow';
  const panelClasses = isShadow ? 'bg-card/95 shadow-lg rounded-lg relative' : 'bg-card border border-border rounded-lg relative';
  const chipClasses = `text-sm font-normal px-3 py-1 bg-background/80 ${isShadow ? 'shadow-md' : 'border border-border'} rounded-md flex items-center gap-1`;

  // Select a channel from the grid, mirroring the current program into the poster / popup.
  const selectChannel = (channel: Channel, log: boolean) => {
    if (log) logger.info(`Selected: Channel "${channel.name}" in Full Guide`);
    setSelectedChannel(channel);
    const currentProg = getCurrentProgram(epgData[channel.id] || []);
    if (currentProg && (currentProg.image || currentProg.icon)) {
      setSelectedPoster(currentProg);
    }
    if (currentProg) {
      setFocusedProgram({ program: currentProg, channel });
    }
  };

  const handleProgramClick = (program: Program) => {
    const channel = channels.find((c) => c.id === program.channelId);
    if (channel) {
      logger.info(`Opened: Program Popup for "${program.title}" on ${channel.name}`);
      setFocusedProgram({ program, channel });
    }
  };

  const ordinal = (d: number) =>
    ['th', 'st', 'nd', 'rd'][d % 10 > 3 || Math.floor((d % 100) / 10) === 1 ? 0 : d % 10];

  return (
    <div className={`h-[50vh] ${panelClasses}`}>
      <div className="absolute top-2 left-2 z-30 flex gap-2">
        <div className={`text-sm font-bold px-3 py-1 bg-background/80 ${isShadow ? 'shadow-md' : 'border border-border'} rounded-md`}>
          Full TV Guide
        </div>
        <div className={chipClasses}>
          <Clock className="w-3 h-3" />
          {formatTime(currentTime)}
        </div>
        <div className={chipClasses}>
          <Calendar className="w-3 h-3" />
          {currentTime.toLocaleDateString('en-GB', { weekday: 'long' })}
        </div>
        <div className={chipClasses}>
          <Calendar className="w-3 h-3" />
          {currentTime.getDate()}{ordinal(currentTime.getDate())} {currentTime.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </div>
      </div>
      <div className="absolute top-2 right-2 z-30 flex gap-2">
        <button
          className={`w-8 h-8 flex items-center justify-center bg-background/80 hover:bg-background ${isShadow ? 'shadow-md' : 'border border-border'} rounded-md transition-colors`}
          onClick={onRefresh}
          title="Refresh EPG Data & Reset to Current Time"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          className={`w-8 h-8 flex items-center justify-center bg-background/80 hover:bg-background ${isShadow ? 'shadow-md' : 'border border-border'} rounded-md transition-colors`}
          onClick={onCloseGuide}
          title="Close Full TV Guide"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={fullGuideRef} className="h-full overflow-auto pt-12">
        {focusedProgram ? (
          <div className="flex flex-1 h-full relative">
            <ProgramPopup
              focused={focusedProgram}
              favorites={favorites}
              panelStyle={panelStyle}
              onClose={() => setFocusedProgram(null)}
              onSelectChannel={setSelectedChannel}
              toggleFavorite={toggleFavorite}
            />
            {/* Grid underneath */}
            <div className="flex flex-1 h-full">
              <GuideChannelColumn
                channels={channels}
                selectedChannel={selectedChannel}
                panelStyle={panelStyle}
                rowClass="h-16"
                onSelectChannel={(channel) => selectChannel(channel, true)}
                selectedRowRef={selectedRowRef}
              />
              <GuideProgramGrid
                channels={channels}
                epgData={epgData}
                selectedChannel={selectedChannel}
                favorites={favorites}
                panelStyle={panelStyle}
                onProgramClick={handleProgramClick}
                toggleFavorite={toggleFavorite}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-auto">
            <GuideChannelColumn
              channels={channels}
              selectedChannel={selectedChannel}
              panelStyle={panelStyle}
              rowClass="h-12"
              showBottomPadding
              onSelectChannel={(channel) => selectChannel(channel, false)}
              selectedRowRef={selectedRowRef}
            />
            <GuideProgramGrid
              channels={channels}
              epgData={epgData}
              selectedChannel={selectedChannel}
              favorites={favorites}
              panelStyle={panelStyle}
              timelineRef={mainTimelineRef}
              onProgramClick={handleProgramClick}
              toggleFavorite={toggleFavorite}
            />
          </div>
        )}
      </div>
    </div>
  );
};
