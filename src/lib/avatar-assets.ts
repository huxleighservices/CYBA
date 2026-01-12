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
    { name: 'SKIN1', url: '/avatar/skin/SKIN1.png', hint: 'skin tone light' },
    { name: 'SKIN2', url: '/avatar/skin/SKIN2.png', hint: 'skin tone medium' },
    { name: 'SKIN3', url: '/avatar/skin/SKIN3.png', hint: 'skin tone dark' },
    { name: 'SKIN4', url: '/avatar/skin/SKIN4.png', hint: 'skin tone deep' },
    { name: 'SKIN5', url: '/avatar/skin/SKIN5.png', hint: 'skin tone rich' },
  ],
  hat: [
    { name: 'None', url: '/images/transparent.png', hint: 'nothing empty' },
    ...Array.from({ length: 10 }, (_, i) => ({
      name: `Hat ${i + 1}`,
      url: `/avatar/hat/HAT${String(i + 1).padStart(4, '0')}.png`,
      hint: 'avatar hat',
    })),
  ],
  shirt: [
    { name: 'None', url: '/images/transparent.png', hint: 'nothing empty' },
    ...Array.from({ length: 10 }, (_, i) => ({
    name: `Shirt ${i + 1}`,
    url: `/avatar/shirt/SHIRT${String(i + 1).padStart(4, '0')}.png`,
    hint: 'avatar shirt',
  }))],
  pants: [
    { name: 'None', url: '/images/transparent.png', hint: 'nothing empty' },
    ...Array.from({ length: 10 }, (_, i) => ({
    name: `Pants ${i + 1}`,
    url: `/avatar/pants/PANTS${String(i + 1).padStart(4, '0')}.png`,
    hint: 'avatar pants',
  }))],
  shoes: [
    { name: 'None', url: '/images/transparent.png', hint: 'nothing empty' },
    ...Array.from({ length: 10 }, (_, i) => ({
    name: `Shoes ${i + 1}`,
    url: `/avatar/shoes/SHOES${String(i + 1).padStart(4, '0')}.png`,
    hint: 'avatar shoes',
  }))],
  accessory: [
    { name: 'None', url: '/images/transparent.png', hint: 'nothing empty' },
    ...Array.from({ length: 10 }, (_, i) => ({
      name: `Accessory ${i + 1}`,
      url: `/avatar/accessory/ITEM${String(i + 1).padStart(4, '0')}.png`,
      hint: 'avatar accessory',
    })),
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
