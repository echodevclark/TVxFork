import { RefObject } from "react";
import { Channel } from "@/types/iptv";
import { Tv } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { formatChannelName, getChannelCategory } from "@/utils/channelFormat";

interface GuideChannelColumnProps {
  channels: Channel[];
  selectedChannel: Channel | null;
  panelStyle: 'bordered' | 'shadow';
  // Tailwind height class for the header and rows ('h-16' in the popup view, 'h-12' otherwise).
  rowClass: string;
  showBottomPadding?: boolean;
  onSelectChannel: (channel: Channel) => void;
  selectedRowRef: RefObject<HTMLDivElement | null>;
}

// The left channel column of the full-guide grid, shared by both guide views.
export const GuideChannelColumn = ({
  channels,
  selectedChannel,
  panelStyle,
  rowClass,
  showBottomPadding,
  onSelectChannel,
  selectedRowRef,
}: GuideChannelColumnProps) => {
  const border = panelStyle === 'shadow' ? '' : 'border-b border-border';

  return (
    <div className={`w-48 flex-shrink-0 ${panelStyle === 'shadow' ? '' : 'border-r border-border'}`}>
      <div className={`${rowClass} bg-muted flex items-center px-4 font-semibold ${border}`}>Channel</div>
      {channels.map((channel, index) => (
        <div
          key={channel.id}
          ref={channel.id === selectedChannel?.id ? selectedRowRef : null}
          className={`${rowClass} flex items-center px-3 cursor-pointer hover:bg-secondary/50 ${border} ${channel.id === selectedChannel?.id ? 'bg-gradient-primary text-primary-foreground' : index % 2 === 0 ? 'bg-background' : 'bg-muted/50'}`}
          onClick={() => onSelectChannel(channel)}
        >
          <div className="flex items-center gap-2 flex-1">
            {channel.logo ? (
              <img
                src={channel.logo}
                alt={`${channel.name} logo`}
                className="w-8 h-8 rounded object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center">
                <Tv className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{formatChannelName(channel.name)}</p>
            </div>
            <div>
              <CategoryIcon
                category={getChannelCategory(channel.name, channel.group)}
                className="w-3 h-3 text-muted-foreground"
              />
            </div>
          </div>
        </div>
      ))}
      {showBottomPadding && (
        // Padding at the bottom so the last channel can be scrolled into view.
        <div className="h-screen" />
      )}
    </div>
  );
};
