import { Clapperboard, Tv, Trophy, History } from "lucide-react";
import { ChannelCategory } from "@/utils/channelFormat";

const ICONS = {
  movie: Clapperboard,
  show: Tv,
  sport: Trophy,
  history: History,
  doc: History,
} as const;

interface CategoryIconProps {
  category: ChannelCategory;
  className?: string;
}

// Renders the lucide icon for a channel category, or nothing when there is no category.
export const CategoryIcon = ({ category, className }: CategoryIconProps) => {
  if (!category) return null;
  const Icon = ICONS[category];
  return <Icon className={className} />;
};
