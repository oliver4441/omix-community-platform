// Icon component using inline SVG paths

export type IconName =
  | 'hash' | 'message-square' | 'plus' | 'plus-circle'
  | 'settings' | 'search' | 'chevron-down' | 'chevron-up'
  | 'chevron-left' | 'chevron-right' | 'close' | 'pin'
  | 'reply' | 'thumbs-up' | 'edit' | 'delete'
  | 'send' | 'emoji' | 'file' | 'image'
  | 'server' | 'globe' | 'users' | 'user'
  | 'admin' | 'sign-out' | 'copy' | 'check'
  | 'eye' | 'eye-off' | 'calendar' | 'clock'
  | 'message-circle' | 'at-sign' | 'more-horizontal'
  | 'more-vertical' | 'grid' | 'mail'
  | 'home' | 'info' | 'trash' | 'download'
  | 'camera' | 'mention' | 'phone' | 'paperclip'
  | 'shield' | 'alert-triangle' | 'fingerprint'
  | 'tree-pine' | 'utensils' | 'gamepad-2' | 'plane' | 'package' | 'flag' | 'smile' | 'heart';

const ICON_PATHS: Record<IconName, { paths: string | string[]; viewBox?: string }> = {
  hash: {
    paths: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-5m0 0l-5-5m5 5H6',
  },
  'message-square': {
    paths: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
  'message-circle': {
    paths: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  },
  plus: {
    paths: 'M12 4v16m8-8H4',
  },
  'plus-circle': {
    paths: 'M12 4v16m8-8H4',
  },
  settings: {
    paths: ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
  },
  search: {
    paths: ['circle cx="11" cy="11" r="8"', 'M21 21l-4.35-4.35'],
  },
  'chevron-down': {
    paths: 'M19 9l-7 7-7-7',
  },
  'chevron-up': {
    paths: 'M5 15l7-7 7 7',
  },
  'chevron-left': {
    paths: 'M15 19l-7-7 7-7',
  },
  'chevron-right': {
    paths: 'M9 5l7 7-7 7',
  },
  close: {
    paths: 'M6 18L18 6M6 6l12 12',
  },
  pin: {
    paths: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z',
  },
  reply: {
    paths: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
  },
  'thumbs-up': {
    paths: 'M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3',
  },
  edit: {
    paths: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7',
  },
  delete: {
    paths: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  },
  send: {
    paths: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  },
  emoji: {
    paths: ['circle cx="12" cy="12" r="10"', 'M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01', 'M15 9h.01'],
  },
  file: {
    paths: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6',
  },
  image: {
    paths: ['M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'],
  },
  server: {
    paths: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  },
  globe: {
    paths: ['circle cx="12" cy="12" r="10"', 'M2 12h20', 'M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z'],
  },
  users: {
    paths: 'M17 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1m8-11a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 110-6 3 3 0 010 6zm-4 7v-1a5.97 5.97 0 00-4-5.618',
  },
  user: {
    paths: ['circle cx="12" cy="8" r="5"', 'M3 21v-2a7 7 0 0114 0v2'],
  },
  admin: {
    paths: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  'sign-out': {
    paths: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5m0 0l-5-5m5 5H9',
  },
  copy: {
    paths: ['M8 4v1h8V4a2 2 0 00-2-2h-4a2 2 0 00-2 2z', 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2'],
  },
  check: {
    paths: 'M5 13l4 4L19 7',
  },
  eye: {
    paths: ['M15 12a3 3 0 11-6 0 3 3 0 016 0z', 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'],
  },
  'eye-off': {
    paths: ['M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21'],
  },
  calendar: {
    paths: ['M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z'],
  },
  clock: {
    paths: ['M12 6v6l4 2', 'circle cx="12" cy="12" r="10"'],
  },
  'at-sign': {
    paths: ['M16 8v4a4 4 0 01-8 0v-1a3 3 0 016 0v5a5 5 0 01-10 0v-5a7 7 0 0114 0v1', 'circle cx="12" cy="12" r="10"'],
  },
  'more-horizontal': {
    paths: ['M5 12h.01M12 12h.01M19 12h.01'],
  },
  'more-vertical': {
    paths: 'M12 5v.01M12 12v.01M12 19v.01',
  },
  grid: {
    paths: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
  },
  mail: {
    paths: ['M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'],
  },
  home: {
    paths: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z',
  },
  info: {
    paths: ['circle cx="12" cy="12" r="10"', 'M12 16v-4', 'M12 8h.01'],
  },
  trash: {
    paths: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  },
  download: {
    paths: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m7-3v10m-4-6l4 4 4-4',
  },
  camera: {
    paths: ['M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z', 'M12 17a4 4 0 110-8 4 4 0 010 8z'],
  },
  mention: {
    paths: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  },
  phone: {
    paths: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z',
  },
  paperclip: {
    paths: 'M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48',
  },
  shield: {
    paths: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  },
  'alert-triangle': {
    paths: ['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  },
  fingerprint: {
    paths: [
      'M17.399 22C15.829 18.728 13.144 16 12 16c-1.144 0-3.829 2.728-5.399 6',
      'M12 2c-3.314 0-6 2.686-6 6 0 1.657.672 3.157 1.757 4.243',
      'M12 2c1.757 0 3.343.685 4.536 1.786',
      'M17.399 22c.785-1.818 1.034-3.294 1.034-5.5 0-2.5-1.5-4.5-3-5.5',
      'M12 2c2.5 0 4.5 1.5 5.5 3',
      'M12 2c-2.5 0-4.5 1.5-5.5 3',
      'M17.399 22H6.601',
      'M6.601 22c-1.5-2-2.25-3.5-2.25-5.5 0-1.5.5-3 1.5-4.5',
      'M12 10c1.5 0 2.5 1 2.5 3 0 1.5-.5 3.5-1 5',
    ],
  },
  'tree-pine': {
    paths: 'M12 2v20M12 2l-5 5M12 2l5 5M8 12l-4 4M16 12l4 4M5 17l-2 3M19 17l2 3',
  },
  utensils: {
    paths: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2a5 5 0 00-5-5v6c0 1.1.9 2 2 2h4v4M15 7h.01',
  },
  'gamepad-2': {
    paths: 'M12 3v18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2M9 12h.01M15 12h.01',
  },
  plane: {
    paths: 'M17.8 4.8l-6.6 3.3c-1.2.6-1.2 2.4 0 3l6.6 3.3c1.2.6 2.4-.6 2.4-1.8V5c0-1.2-1.2-2.4-2.4-1.8zM3 12l10-5v10l-10-5zM3 12l10 5v-10l-10 5z',
  },
  package: {
    paths: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM12 22V12M12 22l-5-5M12 22l5-5',
  },
  flag: {
    paths: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22V4',
  },
  smile: {
    paths: ['M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z', 'M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01M15 9h.01'],
  },
  heart: {
    paths: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z',
  },
};

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
};

export function Icon({ name, size = 20, className = '' }: IconProps) {
  const icon = ICON_PATHS[name];
  if (!icon) return null;

  const paths = Array.isArray(icon.paths) ? icon.paths : [icon.paths];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={icon.viewBox || '0 0 24 24'}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
