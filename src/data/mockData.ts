/**
 * SPHERE — Mock data stub
 * All pages now fetch from Supabase. This file only exists so
 * legacy imports don't break during the transition.
 */

export const mockUsers:         never[] = [];
export const mockPosts:         never[] = [];
export const mockComments:      never[] = [];
export const mockNotifications: never[] = [];
export const mockStoriesUsers:  never[] = [];
export const mockProfilePosts:  never[] = [];
export const trendingHashtags:  never[] = [];

export const suggestedCategories = [
  { id: "technology",     label: "Technology",     icon: "💻" },
  { id: "cricket",        label: "Cricket",        icon: "🏏" },
  { id: "bollywood",      label: "Bollywood",      icon: "🎬" },
  { id: "science",        label: "Science",        icon: "🔬" },
  { id: "politics",       label: "Politics",       icon: "🏛️" },
  { id: "music",          label: "Music",          icon: "🎵" },
  { id: "travel",         label: "Travel",         icon: "✈️" },
  { id: "food",           label: "Food",           icon: "🍜" },
  { id: "gaming",         label: "Gaming",         icon: "🎮" },
  { id: "finance",        label: "Finance",        icon: "📈" },
  { id: "fitness",        label: "Fitness",        icon: "💪" },
  { id: "art",            label: "Art",            icon: "🎨" },
  { id: "environment",    label: "Environment",    icon: "🌿" },
  { id: "education",      label: "Education",      icon: "📚" },
  { id: "fashion",        label: "Fashion",        icon: "👗" },
  { id: "sports",         label: "Sports",         icon: "⚽" },
  { id: "city",           label: "City",           icon: "🏙️" },
  { id: "entertainment",  label: "Entertainment",  icon: "🎭" },
  { id: "world",          label: "World",          icon: "🌍" },
  { id: "startups",       label: "Startups",       icon: "🚀" },
];

export const currentUser = {
  id: "",
  name: "",
  username: "",
  avatar: "",
  bio: "",
  followers: 0,
  following: 0,
  location: "",
  isVerified: false,
};
