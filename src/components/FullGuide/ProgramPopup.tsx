import { Channel, Program } from "@/types/iptv";
import { X, Play, Clock, Calendar, Star } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { formatChannelName, getChannelCategory } from "@/utils/channelFormat";
import { formatTime, formatDuration } from "@/utils/time";
import { isNowPlaying } from "@/utils/epg";
import { buildGoogleQuery, googleSearchUrl, openGoogleSearch } from "@/utils/search";
import { logger } from "@/utils/logger";

export interface FocusedProgram {
  program: Program;
  channel: Channel;
}

interface ProgramPopupProps {
  focused: FocusedProgram;
  favorites: Set<string>;
  panelStyle: 'bordered' | 'shadow';
  onClose: () => void;
  onSelectChannel: (channel: Channel) => void;
  toggleFavorite: (program: Program) => void;
}

// The focused-program detail panel shown next to the video player in the full guide.
export const ProgramPopup = ({
  focused,
  favorites,
  panelStyle,
  onClose,
  onSelectChannel,
  toggleFavorite,
}: ProgramPopupProps) => {
  const { program, channel } = focused;
  const panelClasses =
    panelStyle === 'shadow' ? 'bg-card/95 shadow-lg' : 'bg-card border border-border';
  const isFavorite = favorites.has(`${program.title}-${program.start.getTime()}`);

  const openSearch = () => {
    logger.info(`Opened: Google Search for "${buildGoogleQuery(program)}"`);
    openGoogleSearch(program);
  };

  return (
    <div
      className={`fixed z-50 ${panelClasses} rounded-lg p-4 shadow-lg w-[555px] min-w-[555px] max-h-[calc(100vh-7rem)] overflow-y-auto`}
      style={{ left: '20px', top: '2rem' }}
    >
      <button
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center hover:bg-muted rounded"
        onClick={() => {
          logger.info('Closed: Program Popup');
          onClose();
        }}
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 mb-3 w-full">
        {/* Poster artwork or channel logo with channel name */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-28">
          {(program.image || program.icon) ? (
            <img
              src={program.image || program.icon}
              alt="Poster"
              className="w-28 h-auto max-h-[300px] object-contain rounded cursor-pointer hover:opacity-80 transition-opacity"
              onClick={openSearch}
            />
          ) : channel.logo ? (
            <img
              src={channel.logo}
              alt={`${channel.name} logo`}
              className="w-12 h-12 rounded object-cover"
            />
          ) : null}
          {/* Channel name with icon - clickable */}
          <div
            className="flex flex-col items-center gap-1"
            onClick={() => onSelectChannel(channel)}
          >
            <Star
              className={`w-[13px] h-[13px] mb-[5px] cursor-pointer ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(program);
              }}
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors">
              <CategoryIcon
                category={getChannelCategory(channel.name, channel.group) ?? 'show'}
                className="w-3 h-3"
              />
              <span className="text-center">{formatChannelName(channel.name)}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold">{program.title}</h3>
            {isNowPlaying(program) && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-cyan-500 text-white flex items-center gap-0.5">
                <Play className="w-2 h-2 fill-white" />
                NOW
              </span>
            )}
          </div>
          {program.subTitle && (
            <h4 className="text-base font-semibold mb-1 text-white italic">{program.subTitle}</h4>
          )}
          <div className="text-sm text-muted-foreground mb-1">
            <Play className="w-3 h-3 inline mr-1" />
            {formatTime(program.start)} - {formatTime(program.end)}
          </div>
          <div className="text-sm text-muted-foreground mb-1">
            <Clock className="w-3 h-3 inline mr-1" />
            {formatDuration(program.start, program.end)}
          </div>
          {program.year && (
            <div className="text-sm text-muted-foreground mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />
              {typeof program.year === 'number' && program.year > 9999
                ? String(program.year).substring(0, 4)
                : program.year}
            </div>
          )}
          {program.season && program.episode && (
            <div className="text-sm text-white mb-1 italic font-medium">
              Season {program.season} Episode {program.episode}
            </div>
          )}
          {program.description && (
            <p className="text-sm mb-2 line-clamp-4">{program.description}</p>
          )}
          {/* More Info link */}
          <div className="text-sm flex items-center gap-3 mb-2">
            <a
              href={googleSearchUrl(program)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
              onClick={() =>
                logger.info(`Opened: Google Search for "${buildGoogleQuery(program)}"`)
              }
            >
              More Info
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
