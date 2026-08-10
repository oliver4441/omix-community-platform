'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Smile,
  Heart,
  Star,
  Hash,
  Globe,
  Zap,
  Award,
  Search,
  X,
} from '@/components/ui/icons';

interface EmojiCategory {
  name: string;
  emojis: { char: string; name: string }[];
}

const CATEGORY_ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  People: Smile,
  Nature: Heart,
  Food: Star,
  Activities: Zap,
  Travel: Globe,
  Objects: Hash,
  Symbols: Heart,
  Flags: Award,
};

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'People',
    emojis: [
      { char: '😀', name: 'grinning face' },
      { char: '😃', name: 'grinning face with big eyes' },
      { char: '😄', name: 'grinning face with smiling eyes' },
      { char: '😁', name: 'beaming face with smiling eyes' },
      { char: '😆', name: 'grinning squinting face' },
      { char: '😅', name: 'grinning face with sweat' },
      { char: '🤣', name: 'rolling on the floor laughing' },
      { char: '😂', name: 'face with tears of joy' },
      { char: '🙂', name: 'slightly smiling face' },
      { char: '😉', name: 'winking face' },
      { char: '😊', name: 'smiling face with smiling eyes' },
      { char: '😇', name: 'smiling face with halo' },
      { char: '🥰', name: 'smiling face with hearts' },
      { char: '😍', name: 'smiling face with heart-eyes' },
      { char: '🤩', name: 'star-struck' },
      { char: '😘', name: 'face blowing a kiss' },
      { char: '😗', name: 'kissing face' },
      { char: '😚', name: 'kissing face with closed eyes' },
      { char: '😙', name: 'kissing face with smiling eyes' },
      { char: '😋', name: 'face savoring food' },
      { char: '😛', name: 'face with tongue' },
      { char: '😜', name: 'winking face with tongue' },
      { char: '🤪', name: 'zany face' },
      { char: '😝', name: 'squinting face with tongue' },
      { char: '🤑', name: 'money-mouth face' },
      { char: '🤗', name: 'hugging face' },
      { char: '🤭', name: 'face with hand over mouth' },
      { char: '🤫', name: 'shushing face' },
      { char: '🤔', name: 'thinking face' },
      { char: '🤐', name: 'zipper-mouth face' },
      { char: '🤨', name: 'face with raised eyebrow' },
      { char: '😐', name: 'neutral face' },
      { char: '😑', name: 'expressionless face' },
      { char: '😶', name: 'face without mouth' },
      { char: '😏', name: 'smirking face' },
      { char: '😒', name: 'unamused face' },
      { char: '🙄', name: 'face with rolling eyes' },
      { char: '😬', name: 'grimacing face' },
      { char: '🤥', name: 'lying face' },
      { char: '😌', name: 'relieved face' },
      { char: '😔', name: 'pensive face' },
      { char: '😪', name: 'sleepy face' },
      { char: '🤤', name: 'drooling face' },
      { char: '😴', name: 'sleeping face' },
      { char: '😷', name: 'face with medical mask' },
      { char: '🤒', name: 'face with thermometer' },
      { char: '🤕', name: 'face with head-bandage' },
      { char: '🤢', name: 'nauseated face' },
      { char: '🤮', name: 'face vomiting' },
      { char: '🤧', name: 'sneezing face' },
      { char: '🥵', name: 'hot face' },
      { char: '🥶', name: 'cold face' },
      { char: '🥴', name: 'woozy face' },
      { char: '😵', name: 'knocked-out face' },
      { char: '🤯', name: 'exploding head' },
      { char: '🤠', name: 'cowboy hat face' },
      { char: '🥳', name: 'partying face' },
      { char: '😎', name: 'smiling face with sunglasses' },
      { char: '🤓', name: 'nerd face' },
      { char: '🧐', name: 'monocle face' },
      { char: '😕', name: 'confused face' },
      { char: '😟', name: 'worried face' },
      { char: '🙁', name: 'slightly frowning face' },
      { char: '☹️', name: 'frowning face' },
      { char: '😮', name: 'face with open mouth' },
      { char: '😯', name: 'hushed face' },
      { char: '😲', name: 'astonished face' },
      { char: '😳', name: 'flushed face' },
      { char: '😱', name: 'face screaming in fear' },
      { char: '😨', name: 'fearful face' },
      { char: '😰', name: 'anxious face with sweat' },
      { char: '😢', name: 'crying face' },
      { char: '😭', name: 'loudly crying face' },
      { char: '😤', name: 'steam from nose' },
      { char: '😠', name: 'angry face' },
      { char: '😡', name: 'pouting face' },
      { char: '🤬', name: 'face with symbols on mouth' },
    ],
  },
  {
    name: 'Nature',
    emojis: [
      { char: '🐶', name: 'dog face' },
      { char: '🐱', name: 'cat face' },
      { char: '🐭', name: 'mouse face' },
      { char: '🐹', name: 'hamster' },
      { char: '🐰', name: 'rabbit face' },
      { char: '🦊', name: 'fox' },
      { char: '🐻', name: 'bear' },
      { char: '🐼', name: 'panda' },
      { char: '🐨', name: 'koala' },
      { char: '🐯', name: 'tiger' },
      { char: '🦁', name: 'lion' },
      { char: '🐮', name: 'cow' },
      { char: '🐷', name: 'pig' },
      { char: '🐸', name: 'frog' },
      { char: '🐵', name: 'monkey face' },
      { char: '🐔', name: 'chicken' },
      { char: '🐧', name: 'penguin' },
      { char: '🐦', name: 'bird' },
      { char: '🐤', name: 'baby chick' },
      { char: '🦋', name: 'butterfly' },
      { char: '🐛', name: 'bug' },
      { char: '🐝', name: 'honeybee' },
      { char: '🐞', name: 'lady beetle' },
      { char: '🦄', name: 'unicorn' },
      { char: '🐴', name: 'horse face' },
      { char: '🐌', name: 'snail' },
      { char: '🐚', name: 'spiral shell' },
      { char: '🐠', name: 'tropical fish' },
      { char: '🐟', name: 'fish' },
      { char: '🐬', name: 'dolphin' },
      { char: '🐳', name: 'spouting whale' },
      { char: '🐋', name: 'whale' },
      { char: '🐊', name: 'crocodile' },
      { char: '🌸', name: 'cherry blossom' },
      { char: '🌷', name: 'tulip' },
      { char: '🌹', name: 'rose' },
      { char: '🌻', name: 'sunflower' },
      { char: '🌺', name: 'hibiscus' },
      { char: '🌲', name: 'evergreen' },
      { char: '🌳', name: 'deciduous tree' },
      { char: '🌴', name: 'palm tree' },
      { char: '🌵', name: 'cactus' },
      { char: '⭐', name: 'star' },
      { char: '🌟', name: 'glowing star' },
      { char: '🌙', name: 'moon' },
      { char: '☀️', name: 'sun' },
      { char: '🌈', name: 'rainbow' },
      { char: '☁️', name: 'cloud' },
      { char: '⚡', name: 'lightning' },
      { char: '❄️', name: 'snowflake' },
      { char: '🔥', name: 'fire' },
      { char: '💧', name: 'droplet' },
      { char: '🌊', name: 'water wave' },
    ],
  },
  {
    name: 'Food',
    emojis: [
      { char: '🍏', name: 'green apple' },
      { char: '🍎', name: 'red apple' },
      { char: '🍐', name: 'pear' },
      { char: '🍊', name: 'tangerine' },
      { char: '🍋', name: 'lemon' },
      { char: '🍌', name: 'banana' },
      { char: '🍉', name: 'watermelon' },
      { char: '🍇', name: 'grapes' },
      { char: '🍓', name: 'strawberry' },
      { char: '🍈', name: 'melon' },
      { char: '🍒', name: 'cherries' },
      { char: '🍑', name: 'peach' },
      { char: '🍍', name: 'pineapple' },
      { char: '🥝', name: 'kiwi' },
      { char: '🍅', name: 'tomato' },
      { char: '🥑', name: 'avocado' },
      { char: '🥦', name: 'broccoli' },
      { char: '🥕', name: 'carrot' },
      { char: '🌽', name: 'corn' },
      { char: '🍞', name: 'bread' },
      { char: '🧀', name: 'cheese' },
      { char: '🍔', name: 'hamburger' },
      { char: '🍟', name: 'fries' },
      { char: '🍕', name: 'pizza' },
      { char: '🌭', name: 'hot dog' },
      { char: '🥪', name: 'sandwich' },
      { char: '🌮', name: 'taco' },
      { char: '🌯', name: 'burrito' },
      { char: '🥗', name: 'salad' },
      { char: '🍿', name: 'popcorn' },
      { char: '🍱', name: 'bento' },
      { char: '🍣', name: 'sushi' },
      { char: '🍜', name: 'ramen' },
      { char: '🍝', name: 'spaghetti' },
      { char: '🍦', name: 'ice cream' },
      { char: '🍩', name: 'doughnut' },
      { char: '🍪', name: 'cookie' },
      { char: '🎂', name: 'birthday cake' },
      { char: '🍰', name: 'cake' },
      { char: '🧁', name: 'cupcake' },
      { char: '🍫', name: 'chocolate' },
      { char: '🍬', name: 'candy' },
      { char: '🍭', name: 'lollipop' },
      { char: '🍺', name: 'beer' },
      { char: '🍻', name: 'clinking beers' },
      { char: '🥂', name: 'champagne' },
      { char: '🍷', name: 'wine glass' },
      { char: '🥤', name: 'cup with straw' },
      { char: '☕', name: 'coffee' },
      { char: '🍵', name: 'tea' },
    ],
  },
  {
    name: 'Activities',
    emojis: [
      { char: '⚽', name: 'soccer' },
      { char: '🏀', name: 'basketball' },
      { char: '🏈', name: 'football' },
      { char: '⚾', name: 'baseball' },
      { char: '🎾', name: 'tennis' },
      { char: '🏐', name: 'volleyball' },
      { char: '🏓', name: 'ping pong' },
      { char: '🎱', name: 'pool 8 ball' },
      { char: '🏸', name: 'badminton' },
      { char: '🥊', name: 'boxing glove' },
      { char: '🥋', name: 'martial arts' },
      { char: '🎯', name: 'dart' },
      { char: '🎮', name: 'video game' },
      { char: '🎲', name: 'game die' },
      { char: '♠️', name: 'spade' },
      { char: '♥️', name: 'heart' },
      { char: '♦️', name: 'diamond' },
      { char: '♣️', name: 'club' },
      { char: '🎭', name: 'performing arts' },
      { char: '🎨', name: 'art' },
      { char: '🎵', name: 'music' },
      { char: '🎶', name: 'musical notes' },
      { char: '🎤', name: 'microphone' },
      { char: '🎧', name: 'headphone' },
      { char: '🎸', name: 'guitar' },
      { char: '🎹', name: 'piano' },
      { char: '🎺', name: 'trumpet' },
      { char: '🎻', name: 'violin' },
      { char: '🥁', name: 'drum' },
      { char: '🎬', name: 'clapper' },
      { char: '🏆', name: 'trophy' },
      { char: '🥇', name: '1st medal' },
      { char: '🥈', name: '2nd medal' },
      { char: '🥉', name: '3rd medal' },
      { char: '🎖️', name: 'medal' },
    ],
  },
  {
    name: 'Travel',
    emojis: [
      { char: '🚗', name: 'car' },
      { char: '🚕', name: 'taxi' },
      { char: '🚙', name: 'SUV' },
      { char: '🚌', name: 'bus' },
      { char: '🚎', name: 'trolleybus' },
      { char: '🏎️', name: 'race car' },
      { char: '🚓', name: 'police car' },
      { char: '🚑', name: 'ambulance' },
      { char: '🚒', name: 'fire engine' },
      { char: '🚐', name: 'minibus' },
      { char: '🚲', name: 'bicycle' },
      { char: '🛴', name: 'scooter' },
      { char: '🏍️', name: 'motorcycle' },
      { char: '🚂', name: 'train' },
      { char: '🚆', name: 'train2' },
      { char: '🚇', name: 'metro' },
      { char: '🚊', name: 'tram' },
      { char: '✈️', name: 'airplane' },
      { char: '🛫', name: 'departure' },
      { char: '🛬', name: 'arrival' },
      { char: '🚁', name: 'helicopter' },
      { char: '🚀', name: 'rocket' },
      { char: '🛸', name: 'UFO' },
      { char: '🛰️', name: 'satellite' },
      { char: '🚢', name: 'ship' },
      { char: '⛵', name: 'sailboat' },
      { char: '🚤', name: 'speedboat' },
      { char: '🛳️', name: 'cruise ship' },
      { char: '🗺️', name: 'world map' },
      { char: '🏔️', name: 'mountain' },
      { char: '🏖️', name: 'beach' },
      { char: '🏜️', name: 'desert' },
      { char: '🏝️', name: 'island' },
      { char: '🏗️', name: 'construction' },
    ],
  },
  {
    name: 'Objects',
    emojis: [
      { char: '⌚', name: 'watch' },
      { char: '📱', name: 'smartphone' },
      { char: '💻', name: 'laptop' },
      { char: '🖥️', name: 'desktop' },
      { char: '🖨️', name: 'printer' },
      { char: '⌨️', name: 'keyboard' },
      { char: '🖱️', name: 'mouse' },
      { char: '💡', name: 'light bulb' },
      { char: '🔦', name: 'flashlight' },
      { char: '🔋', name: 'battery' },
      { char: '🔌', name: 'plug' },
      { char: '💎', name: 'diamond' },
      { char: '🔑', name: 'key' },
      { char: '🔒', name: 'locked' },
      { char: '🔓', name: 'unlocked' },
      { char: '🔐', name: 'locked with key' },
      { char: '🔗', name: 'link' },
      { char: '📎', name: 'paperclip' },
      { char: '🖊️', name: 'pen' },
      { char: '✏️', name: 'pencil' },
      { char: '📌', name: 'pushpin' },
      { char: '📍', name: 'round pushpin' },
      { char: '📏', name: 'ruler' },
      { char: '📐', name: 'triangle ruler' },
      { char: '✂️', name: 'scissors' },
      { char: '🔧', name: 'wrench' },
      { char: '🔨', name: 'hammer' },
      { char: '🪛', name: 'screwdriver' },
      { char: '🔩', name: 'nut and bolt' },
      { char: '⚙️', name: 'gear' },
      { char: '🧰', name: 'toolbox' },
      { char: '🧲', name: 'magnet' },
      { char: '🪜', name: 'ladder' },
      { char: '📦', name: 'package' },
      { char: '🎁', name: 'gift' },
      { char: '🎈', name: 'balloon' },
      { char: '🎉', name: 'party popper' },
      { char: '🎊', name: 'confetti ball' },
    ],
  },
  {
    name: 'Symbols',
    emojis: [
      { char: '❤️', name: 'red heart' },
      { char: '🧡', name: 'orange heart' },
      { char: '💛', name: 'yellow heart' },
      { char: '💚', name: 'green heart' },
      { char: '💙', name: 'blue heart' },
      { char: '💜', name: 'purple heart' },
      { char: '🖤', name: 'black heart' },
      { char: '🤍', name: 'white heart' },
      { char: '💔', name: 'broken heart' },
      { char: '💕', name: 'two hearts' },
      { char: '💞', name: 'revolving hearts' },
      { char: '💓', name: 'beating heart' },
      { char: '💗', name: 'growing heart' },
      { char: '💖', name: 'sparkling heart' },
      { char: '💘', name: 'heart with arrow' },
      { char: '💝', name: 'heart with ribbon' },
      { char: '💟', name: 'heart decoration' },
      { char: '✅', name: 'check mark' },
      { char: '❌', name: 'cross mark' },
      { char: '❓', name: 'question mark' },
      { char: '❗', name: 'exclamation' },
      { char: '➕', name: 'plus' },
      { char: '➖', name: 'minus' },
      { char: '➗', name: 'divide' },
      { char: '♻️', name: 'recycle' },
      { char: '💯', name: '100 points' },
      { char: '💢', name: 'anger' },
      { char: '💬', name: 'speech bubble' },
      { char: '🗨️', name: 'left speech bubble' },
      { char: '🗯️', name: 'right anger bubble' },
      { char: '♨️', name: 'hot springs' },
      { char: '🛐', name: 'place of worship' },
      { char: '☮️', name: 'peace' },
      { char: '✝️', name: 'cross' },
      { char: '☪️', name: 'star and crescent' },
      { char: '☸️', name: 'wheel of dharma' },
      { char: '✡️', name: 'star of david' },
      { char: '☯️', name: 'yin yang' },
      { char: '🕉️', name: 'om' },
      { char: '🔯', name: 'six pointed star' },
      { char: '♈', name: 'aries' },
      { char: '♉', name: 'taurus' },
      { char: '♊', name: 'gemini' },
      { char: '♋', name: 'cancer' },
      { char: '♌', name: 'leo' },
      { char: '♍', name: 'virgo' },
      { char: '♎', name: 'libra' },
      { char: '♏', name: 'scorpio' },
      { char: '♐', name: 'sagittarius' },
      { char: '♑', name: 'capricorn' },
      { char: '♒', name: 'aquarius' },
      { char: '♓', name: 'pisces' },
      { char: '⛎', name: 'ophiuchus' },
    ],
  },
  {
    name: 'Flags',
    emojis: [
      { char: '🏳️', name: 'white flag' },
      { char: '🏴', name: 'black flag' },
      { char: '🏁', name: 'checkered flag' },
      { char: '🚩', name: 'triangular flag' },
      { char: '🏳️‍🌈', name: 'rainbow flag' },
      { char: '🇺🇸', name: 'United States' },
      { char: '🇬🇧', name: 'United Kingdom' },
      { char: '🇨🇦', name: 'Canada' },
      { char: '🇦🇺', name: 'Australia' },
      { char: '🇫🇷', name: 'France' },
      { char: '🇩🇪', name: 'Germany' },
      { char: '🇮🇹', name: 'Italy' },
      { char: '🇪🇸', name: 'Spain' },
      { char: '🇯🇵', name: 'Japan' },
      { char: '🇨🇳', name: 'China' },
      { char: '🇮🇳', name: 'India' },
      { char: '🇧🇷', name: 'Brazil' },
      { char: '🇷🇺', name: 'Russia' },
      { char: '🇰🇷', name: 'South Korea' },
      { char: '🇸🇬', name: 'Singapore' },
      { char: '🇳🇱', name: 'Netherlands' },
      { char: '🇸🇪', name: 'Sweden' },
      { char: '🇳🇴', name: 'Norway' },
      { char: '🇩🇰', name: 'Denmark' },
      { char: '🇫🇮', name: 'Finland' },
      { char: '🇮🇪', name: 'Ireland' },
      { char: '🇨🇭', name: 'Switzerland' },
      { char: '🇦🇹', name: 'Austria' },
      { char: '🇧🇪', name: 'Belgium' },
      { char: '🇵🇹', name: 'Portugal' },
      { char: '🇬🇷', name: 'Greece' },
      { char: '🇵🇱', name: 'Poland' },
      { char: '🇨🇿', name: 'Czech Republic' },
      { char: '🇭🇺', name: 'Hungary' },
      { char: '🇷🇴', name: 'Romania' },
      { char: '🇺🇦', name: 'Ukraine' },
      { char: '🇹🇷', name: 'Turkey' },
      { char: '🇮🇱', name: 'Israel' },
      { char: '🇦🇪', name: 'UAE' },
      { char: '🇸🇦', name: 'Saudi Arabia' },
      { char: '🇲🇽', name: 'Mexico' },
      { char: '🇦🇷', name: 'Argentina' },
      { char: '🇨🇱', name: 'Chile' },
      { char: '🇨🇴', name: 'Colombia' },
      { char: '🇿🇦', name: 'South Africa' },
      { char: '🇳🇬', name: 'Nigeria' },
      { char: '🇰🇪', name: 'Kenya' },
      { char: '🇪🇬', name: 'Egypt' },
      { char: '🇹🇭', name: 'Thailand' },
      { char: '🇻🇳', name: 'Vietnam' },
      { char: '🇮🇩', name: 'Indonesia' },
      { char: '🇵🇭', name: 'Philippines' },
      { char: '🇲🇾', name: 'Malaysia' },
      { char: '🇳🇿', name: 'New Zealand' },
    ],
  },
];

export function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    searchInputRef.current?.focus();
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const category = EMOJI_CATEGORIES[activeCategory];

  const filteredEmojis = searchQuery.trim()
    ? EMOJI_CATEGORIES.flatMap((cat) =>
        cat.emojis.filter((e) =>
          e.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : null;

  const displayEmojis = filteredEmojis ?? category.emojis;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-4 mb-2 bg-[var(--color-bg-dark)] border border-[var(--color-border)] rounded-[20px] shadow-2xl p-3 z-50 max-w-[332px] max-h-[400px] flex flex-col"
    >
      {/* Category tabs */}
      <div className="flex gap-0.5 mb-2 overflow-x-auto pb-2 border-b border-[var(--color-border)]">
        {EMOJI_CATEGORIES.map((cat, i) => {
          const CatIcon = CATEGORY_ICON_MAP[cat.name] || Smile;
          return (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(i)}
              className={`flex items-center gap-1 px-2 py-1 rounded-xl text-sm transition-colors whitespace-nowrap ${
                i === activeCategory
                  ? 'bg-[var(--color-pri)] text-white'
                  : 'text-[var(--color-txt-muted)] hover:text-[var(--color-txt)] hover:bg-[var(--color-bg-hover)]'
              }`}
              title={cat.name}
            >
              <CatIcon size={14} />
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-2">
        <div className="flex items-center gap-2 bg-[var(--color-bg-mid)] rounded-xl px-3 border border-[var(--color-border)] focus-within:border-[var(--color-pri)] transition-all">
          <Search size={14} className="text-[var(--color-txt-muted)] shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search emojis..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none py-1.5 text-sm text-[var(--color-txt)] placeholder-[var(--color-txt-muted)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[var(--color-txt-muted)] hover:text-[var(--color-txt)]"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto">
        {displayEmojis.length === 0 ? (
          <div className="text-center text-[var(--color-txt-muted)] text-sm py-4">
            No emojis found
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {displayEmojis.map((emoji) => (
              <button
                key={emoji.char + emoji.name}
                onClick={() => {
                  onSelect(emoji.char);
                  onClose();
                }}
                className="w-8 h-8 flex items-center justify-center text-lg rounded-xl hover:bg-[var(--color-bg-hover)] transition-colors"
                title={emoji.name}
              >
                {emoji.char}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
