// This file acts as a centralized library for all avatar customization assets.
// I'm using placeholder images from `picsum.photos`. You can replace these
// URLs with your actual asset URLs when they are ready. The structure allows for
// easy management and expansion of avatar options.

// The `hint` property is for AI to better understand the image content.

type AvatarOption = {
  name: string;
  url: string;
  hint: string;
};

export type AvatarConfig = {
  skin: number;
  hat: number;
  shirt: number;
  pants: number;
  shoes: number;
  accessory: number;
};

type AvatarOptions = {
  skin: AvatarOption[];
  hat: AvatarOption[];
  shirt: AvatarOption[];
  pants: AvatarOption[];
  shoes: AvatarOption[];
  accessory: AvatarOption[];
};

export const avatarOptions: AvatarOptions = {
  skin: [
    { name: 'Tone 1', url: '/images/avatar/skin/tone1.png', hint: 'skin tone light' },
    { name: 'Tone 2', url: '/images/avatar/skin/tone2.png', hint: 'skin tone medium' },
    { name: 'Tone 3', url: '/images/avatar/skin/tone3.png', hint: 'skin tone dark' },
    { name: 'Tone 4', url: '/images/avatar/skin/tone4.png', hint: 'skin tone deep' },
    { name: 'Tone 5', url: '/images/avatar/skin/tone5.png', hint: 'skin tone rich' },
  ],
  hat: [
    { name: 'None', url: '/images/transparent.png', hint: 'nothing empty' },
    { name: 'Beanie', url: 'https://picsum.photos/seed/hat1/256/256', hint: 'avatar hat' },
    { name: 'Cap', url: 'https://picsum.photos/seed/hat2/256/256', hint: 'avatar cap' },
    { name: 'Headphones', url: 'https://picsum.photos/seed/hat3/256/256', hint: 'avatar headphones' },
  ],
  shirt: [
    { name: 'T-Shirt', url: 'https://picsum.photos/seed/shirt1/256/256', hint: 'avatar shirt' },
    { name: 'Hoodie', url: 'https://picsum.photos/seed/shirt2/256/256', hint: 'avatar hoodie' },
    { name: 'Jacket', url: 'https://picsum.photos/seed/shirt3/256/256', hint: 'avatar jacket' },
  ],
  pants: [
    { name: 'Jeans', url: 'https://picsum.photos/seed/pants1/256/256', hint: 'avatar jeans' },
    { name: 'Sweatpants', url: 'https://picsum.photos/seed/pants2/256/256', hint: 'avatar sweatpants' },
    { name: 'Shorts', url: 'https://picsum.photos/seed/pants3/256/256', hint: 'avatar shorts' },
  ],
  shoes: [
    { name: 'Sneakers', url: 'https://picsum.photos/seed/shoes1/256/256', hint: 'avatar sneakers' },
    { name: 'Boots', url: 'https://picsum.photos/seed/shoes2/256/256', hint: 'avatar boots' },
  ],
  accessory: [
    { name: 'None', url: '/images/transparent.png', hint: 'nothing empty' },
    { name: 'Chain', url: 'https://picsum.photos/seed/accessory1/256/256', hint: 'avatar chain' },
    { name: 'Glasses', url: 'https://picsum.photos/seed/accessory2/256/256', hint: 'avatar glasses' },
  ],
};

export const defaultAvatarConfig: AvatarConfig = {
    skin: 0,
    hat: 0,
    shirt: 0,
    pants: 0,
    shoes: 0,
    accessory: 0,
};

// We need a transparent image for "None" options
// This requires creating a file in `public/images`
// I will assume this file will be created. If not, this might result in a 404.
// This is a limitation I have as an AI.
