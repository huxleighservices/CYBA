// This file acts as a centralized library for all avatar customization assets.
// It explicitly lists available assets to avoid referencing deleted files.

type AvatarOption = {
  name: string;
  url: string;
  hint: string;
};

export type AvatarLayer = 'skin' | 'hat' | 'shirt' | 'pants' | 'shoes' | 'accessory';

export type AvatarConfig = {
  skin: number;
  hat: number;
  shirt: number;
  pants: number;
  shoes: number;
  accessory: number;
  layerOrder: AvatarLayer[];
  emojiStatus?: string;
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
    { name: 'Hat 1', url: '/avatar/hat/HAT0001.png', hint: 'avatar hat' },
    { name: 'Hat 2', url: '/avatar/hat/HAT0002.png', hint: 'avatar hat' },
    { name: 'Hat 3', url: '/avatar/hat/HAT0003.png', hint: 'avatar hat' },
    { name: 'Hat 4', url: '/avatar/hat/HAT0004.png', hint: 'avatar hat' },
    { name: 'Hat 5', url: '/avatar/hat/HAT0005.png', hint: 'avatar hat' },
    { name: 'Hat 6', url: '/avatar/hat/HAT0006.png', hint: 'avatar hat' },
    { name: 'Hat 7', url: '/avatar/hat/HAT0007.png', hint: 'avatar hat' },
  ],
  shirt: [
    { name: 'None', url: '/images/transparent.png', hint: 'nothing empty' },
    { name: 'Shirt 1', url: '/avatar/shirt/SHIRT0001.png', hint: 'avatar shirt' },
    { name: 'Shirt 2', url: '/avatar/shirt/SHIRT0005.png', hint: 'avatar shirt' },
    { name: 'Shirt 3', url: '/avatar/shirt/SHIRT0007.png', hint: 'avatar shirt' },
    { name: 'Shirt 4', url: '/avatar/shirt/SHIRT0008.png', hint: 'avatar shirt' },
  ],
  pants: [
    { name: 'None', url: '/images/transparent.png', hint: 'nothing empty' },
    { name: 'Pants 1', url: '/avatar/pants/PANTS0001.png', hint: 'avatar pants' },
    { name: 'Pants 2', url: '/avatar/pants/PANTS0002.png', hint: 'avatar pants' },
    { name: 'Pants 3', url: '/avatar/pants/PANTS0003.png', hint: 'avatar pants' },
    { name: 'Pants 4', url: '/avatar/pants/PANTS0006.png', hint: 'avatar pants' },
  ],
  shoes: [
    { name: 'None', url: '/images/transparent.png', hint: 'nothing empty' },
    { name: 'Shoes 1', url: '/avatar/shoes/SHOES0001.png', hint: 'avatar shoes' },
    { name: 'Shoes 2', url: '/avatar/shoes/SHOES0002.png', hint: 'avatar shoes' },
    { name: 'Shoes 3', url: '/avatar/shoes/SHOES0003.png', hint: 'avatar shoes' },
    { name: 'Shoes 4', url: '/avatar/shoes/SHOES0004.png', hint: 'avatar shoes' },
    { name: 'Shoes 5', url: '/avatar/shoes/SHOES0005.png', hint: 'avatar shoes' },
    { name: 'Shoes 6', url: '/avatar/shoes/SHOES0006.png', hint: 'avatar shoes' },
  ],
  accessory: [
    { name: 'None', url: '/images/transparent.png', hint: 'nothing empty' },
    { name: 'Accessory 1', url: '/avatar/accessory/ITEM0001.png', hint: 'avatar accessory' },
    { name: 'Accessory 2', url: '/avatar/accessory/ITEM0002.png', hint: 'avatar accessory' },
    { name: 'Accessory 3', url: '/avatar/accessory/ITEM0003.png', hint: 'avatar accessory' },
    { name: 'Accessory 4', url: '/avatar/accessory/ITEM0004.png', hint: 'avatar accessory' },
    { name: 'Accessory 5', url: '/avatar/accessory/ITEM0005.png', hint: 'avatar accessory' },
    { name: 'Accessory 6', url: '/avatar/accessory/ITEM0006.png', hint: 'avatar accessory' },
    { name: 'Accessory 7', url: '/avatar/accessory/ITEM0007.png', hint: 'avatar accessory' },
    { name: 'Accessory 8', url: '/avatar/accessory/ITEM0008.png', hint: 'avatar accessory' },
  ],
};

export const defaultLayerOrder: AvatarLayer[] = [
  'skin',
  'shoes',
  'pants',
  'shirt',
  'accessory',
  'hat',
];

export const defaultAvatarConfig: AvatarConfig = {
  skin: 0,
  hat: 0,
  shirt: 0,
  pants: 0,
  shoes: 0,
  accessory: 0,
  layerOrder: defaultLayerOrder,
  emojiStatus: undefined,
};
