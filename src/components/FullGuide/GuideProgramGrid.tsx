import { RefObject } from "react";
import { Channel, EPGData, Program } from "@/types/iptv";
import { Play, Star } from "lucide-react";
import { formatTime, formatDuration, topOfHour, minutesBetween, PX_PER_MINUTE } from "@/utils/time";
import { getVisiblePrograms, isNowPlaying } from "@/utils/epg";

const ROW_HEIGHT = 64; // px per channel row in the program grid
const HOURS = 24;
const TIMELINE_WIDTH = 240 * HOURS; // 240px per hour

interface GuideProgramGridProps {
  channels: Channel[];
  epgData: EPGData;
  selectedChannel: Channel | null;
  favorites: Set<string>;
  panelStyle: 'bordered' | 'shadow';
  // When provided, the grid becomes horizontally scrollable (non-popup view).
  timelineRef?: RefObject<HTMLDivElement | null>;
  onProgramClick: (program: Program) => void;
  toggleFavorite: (program: Program) => void;
}

// The 24-hour program timeline of the full-guide grid, shared by both guide views.
export const GuideProgramGrid = ({
  channels,
  epgData,
  selectedChannel,
  favorites,
  panelStyle,
  timelineRef,
  onProgramClick,
  toggleFavorite,
}: GuideProgramGridProps) => {
  const now = new Date();
  const baseTime = topOfHour(now);
  const border = panelStyle === 'shadow' ? '' : 'border-b border-border';
  const cellBorder = panelStyle === 'shadow' ? '' : 'border-r border-border';

  const colors = ['bg-slate-700/40', 'bg-black/30'];
  const indicatorLeft = minutesBetween(baseTime, now) * PX_PER_MINUTE;

  return (
    <div ref={timelineRef} className={`flex-1 ${timelineRef ? 'overflow-x-auto' : ''}`}>
      <div className="relative" style={{ width: `${TIMELINE_WIDTH}px`, height: channels.length * ROW_HEIGHT + ROW_HEIGHT + 'px' }}>
        {/* Time headers */}
        <div className={`absolute top-0 left-0 right-0 h-16 bg-muted flex ${border}`}>
          {Array.from({ length: HOURS }, (_, i) => {
            const hour = (baseTime.getHours() + i) % 24;
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            return (
              <div key={i} style={{ width: '240px' }} className={`flex items-center justify-start pl-2 text-sm font-medium ${cellBorder}`}>
                {displayHour} {ampm}
              </div>
            );
          })}
        </div>

        {/* Current time indicator line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 z-10 pointer-events-none"
          style={{ left: `${indicatorLeft}px`, backgroundColor: '#00d9ff', boxShadow: '0 0 10px #00d9ff' }}
        >
          <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full" style={{ backgroundColor: '#00d9ff', boxShadow: '0 0 5px #00d9ff' }} />
        </div>

        {/* Programs */}
        {channels.map((channel, channelIndex) =>
          getVisiblePrograms(epgData[channel.id] || [], baseTime, HOURS).map((program, programIndex) => {
            const displayStart = program.start < baseTime ? baseTime : program.start;
            const left = Math.max(0, minutesBetween(baseTime, displayStart) * PX_PER_MINUTE);
            const width = Math.max(40, minutesBetween(displayStart, program.end) * PX_PER_MINUTE);
            const showText = width >= 80;
            const top = channelIndex * ROW_HEIGHT + ROW_HEIGHT;
            const isFavorite = favorites.has(`${program.title}-${program.start.getTime()}`);
            const nowPlaying = isNowPlaying(program, now) && channel.id === selectedChannel?.id;
            const selectedColor = colors[programIndex % colors.length];

            return (
              <div
                key={`${channel.id}-${program.start.getTime()}-${programIndex}`}
                className={`absolute p-2 ${nowPlaying ? 'ring-2 ring-cyan-400 bg-cyan-900/30' : selectedColor} text-white rounded cursor-pointer hover:opacity-80`}
                style={{ left: left + 'px', top: top + 'px', width: width + 'px', height: '56px' }}
                onClick={() => onProgramClick(program)}
              >
                <div className="absolute bottom-1 right-1">
                  <Star
                    className={`w-3 h-3 cursor-pointer ${isFavorite ? 'fill-white text-white' : 'text-white/70'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(program);
                    }}
                  />
                </div>
                {showText && (
                  <>
                    <div className="font-semibold text-xs truncate">{program.title}</div>
                    <div className="text-xs opacity-90 truncate">
                      <Play className="w-2 h-2 inline mr-1" />
                      {formatTime(program.start)} ({formatDuration(program.start, program.end)})
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
