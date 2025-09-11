// Typed icon registry for Lucide icons, for safe dynamic usage across the app.
// Usage:
//   import { resolveIcon } from '$lib/icons';
//   const Icon = resolveIcon('success') ?? FallbackIcon;
//   <Icon class="w-5 h-5" aria-hidden="true" />

import type { ComponentType } from 'svelte';

// Import Lucide Svelte components (limit to a well-vetted subset used in flows)
import {
  // Status & feedback
  CheckCircle,
  XCircle,
  Info,
  AlertTriangle,
  Loader,
  Clock,
  PauseCircle,
  PlayCircle,

  // Primary actions
  Plus,
  Minus,
  Edit3,
  Save,
  Trash2,
  Copy,
  Move,
  RefreshCcw,
  RotateCcw,
  RotateCw,
  Download,
  Upload,
  Share,
  Link,
  ExternalLink,
  Sliders,
  Settings,
  Wand2,

  // Navigation & structure
  Home,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  MoreVertical,
  MoreHorizontal,

  // Communication
  MessageSquare,

  // Editor
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Code,
  Code2,
  Quote,
  Image,

  // Files & documents
  File,
  FileText,
  FileCode,
  FilePlus,
  FileX,
  Folder,
  FolderOpen,
  Tag,

  // Validation & privacy
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,

  // Time & history
  Calendar,
  Timer,
  History,

  // Users & identity
  User,
  Users,
  UserPlus,
  UserMinus,

  // Misc
  Star,
  Heart,
  Pin,
  PinOff,
  Search,
  Filter
} from 'lucide-svelte';

// Semantic registry keyed by our domain-specific names
export const ICONS = {
  // Status & feedback
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
  pending: Clock,
  working: Loader,
  paused: PauseCircle,
  started: PlayCircle,

  // Assumptions
  assumptionConfirmed: CheckCircle,
  assumptionUnclear: Info, // visually distinct from help; use HelpCircle if imported
  assumptionUnanswered: XCircle,

  // Primary actions
  add: Plus,
  remove: Minus,
  edit: Edit3,
  save: Save,
  delete: Trash2,
  copy: Copy,
  move: Move,
  refresh: RefreshCcw,
  undo: RotateCcw,
  redo: RotateCw,
  download: Download,
  upload: Upload,
  share: Share,
  link: Link,
  externalLink: ExternalLink,
  settings: Settings,
  sliders: Sliders,
  magic: Wand2,

  // Navigation & structure
  home: Home,
  prev: ArrowLeft,
  next: ArrowRight,
  up: ArrowUp,
  down: ArrowDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  chevronsLeft: ChevronsLeft,
  chevronsRight: ChevronsRight,
  menu: Menu,
  moreVertical: MoreVertical,
  moreHorizontal: MoreHorizontal,

  // Communication
  message: MessageSquare,

  // Editor
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strikethrough: Strikethrough,
  list: List,
  listOrdered: ListOrdered,
  code: Code,
  code2: Code2,
  quote: Quote,
  image: Image,

  // Files & documents
  file: File,
  fileText: FileText,
  fileCode: FileCode,
  filePlus: FilePlus,
  fileX: FileX,
  folder: Folder,
  folderOpen: FolderOpen,
  tag: Tag,

  // Validation & privacy
  lock: Lock,
  unlock: Unlock,
  shieldCheck: ShieldCheck,
  shieldAlert: ShieldAlert,
  view: Eye,
  hide: EyeOff,

  // Time & history
  calendar: Calendar,
  timer: Timer,
  history: History,

  // Users & identity
  user: User,
  users: Users,
  userPlus: UserPlus,
  userMinus: UserMinus,

  // Misc
  star: Star,
  heart: Heart,
  pin: Pin,
  pinOff: PinOff,
  search: Search,
  filter: Filter
} as const satisfies Record<string, ComponentType>;

export type IconName = keyof typeof ICONS;

// Common aliases that map to a canonical semantic icon
export const ICON_ALIASES = {
  approve: 'success',
  decline: 'error',
  propose: 'magic',
  export: 'download',
  import: 'upload',
  open: 'externalLink',
  nextStep: 'next',
  prevStep: 'prev'
} as const satisfies Record<string, IconName>;

export type IconAlias = keyof typeof ICON_ALIASES;
export type AnyIconKey = IconName | IconAlias;

// Resolve an icon by semantic name or alias, with optional fallback
export function resolveIcon(name: AnyIconKey, fallback?: ComponentType): ComponentType | undefined {
  const canonical = (ICON_ALIASES as Record<string, IconName>)[name as string] ?? (name as IconName);
  return ICONS[canonical] ?? fallback;
}

// List of available semantic names for UI pickers or validation
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

