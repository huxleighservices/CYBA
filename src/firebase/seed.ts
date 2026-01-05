
import { Firestore, collection, writeBatch, getDocs, doc } from 'firebase/firestore';

const boosts = [
    {
      name: 'Feature Ad Boost',
      price: 30,
      description: 'Promote selected features for the week to increase your reach and engagement.',
      features: [
        'Weekly promotion for selected features',
        'Increased reach and engagement',
        'You choose which feature or features to boost',
        'Available to all CYBAs',
      ],
      buttonText: 'Unlock Feature Ad Boost',
      buttonLink: '#', // Placeholder link
      type: 'boost',
    },
    {
      name: 'Short-Form Clips ( 2 per week )',
      price: 8,
      description: 'Transform your long videos into short viral clips.',
      features: [
        'Two short-form clip created per week',
        'Clipped from your existing long-form content',
        'Formatted for Reels, Shorts, and TikTok',
        'No custom b-roll or effects',
        '60 seconds max',
        'Available to all CYBAs',
      ],
      buttonText: 'Unlock Short-Form Clips',
      buttonLink: '#',
      type: 'boost',
    },
    {
      name: 'CYBAZONE Playlist Placement ( 2 songs )',
      price: 10,
      description: 'Get one song added to the official CYBAZONE curated Spotify playlist.',
      features: [
        'Two songs added to CYBAZONE Spotify playlist',
        'You choose the songs',
        'Placement remains active while membership is active',
        'Available to Surge & Charge CYBAs',
      ],
      buttonText: 'Unlock Playlist Placement',
      buttonLink: '#',
      type: 'boost',
    },
    {
      name: 'Story Takeover',
      price: 2,
      description: 'All of your weekly features get shared to the CYBAZONE story to increase reach and engagement.',
      features: [
        'All weekly features shared to the CYBAZONE story',
        'Increased reach and engagement',
        'Available to all CYBAs',
      ],
      buttonText: 'Unlock Story Boosts',
      buttonLink: '#',
      type: 'boost',
    },
    {
      name: 'CYBAZONE Playlist Placement ( 1 song )',
      price: 7,
      description: 'Get one song added to the official CYBAZONE curated Spotify playlist.',
      features: [
        'One song added to CYBAZONE Spotify playlist',
        'You choose the song',
        'Available to all CYBAs',
        'Placement remains active while membership is active',
      ],
      buttonText: 'Unlock Playlist Placement ( 1 song )',
      buttonLink: '#',
      type: 'boost',
    },
    {
      name: 'Saturday Spotlight',
      price: 9,
      description: 'Add one extra weekly feature posted on Saturday to boost your reach and engagement. *Saturday Spotlight features are bonus highlights and do not impact Top CYBAS of the Week rankings.*',
      features: [
        'Adds one extra feature for the week',
        'Posted on Saturday for maximum attention',
        'Increased reach and engagement',
        'Available to all CYBAs',
      ],
      buttonText: 'Unlock Saturday Spotlight',
      buttonLink: '#',
      type: 'boost',
    },
    {
      name: 'Content Vault',
      price: 5,
      description: 'A secure weekly storage vault for your photos and videos before they are turned into features.',
      features: [
        'Secure storage for raw photos and videos',
        'Keeps your personal device clutter free',
        'Available to all CYBAs',
        'Easy access when ready to create features',
      ],
      buttonText: 'Unlock Content Vault',
      buttonLink: '#',
      type: 'boost',
    },
    {
      name: 'Weekly Strategy Session',
      price: 25,
      description: 'One weekly 30-minute strategy session focused on your goals, content, and next moves.',
      features: [
        'Leave with a clear plan for the next week of content, focus, and growth',
        'Ideal for creatives who want direction, consistency, and momentum',
        'Available to all CYBAs',
      ],
      buttonText: 'Unlock Weekly Strategy Session',
      buttonLink: '#',
      type: 'boost',
    },
    {
      name: 'Priority Boost',
      price: 5,
      description: 'Skip the line all week. Your features are moved to the front of the posting queue.',
      features: [
        'Priority placement in posting queue',
        'Applies to all features for the week',
        'Available to all CYBAS',
      ],
      buttonText: 'Unlock Priority Boost',
      buttonLink: '#',
      type: 'boost',
    },
    {
      name: 'Pinned Comment',
      price: 2,
      description: 'A high-visibility comment on your feature designed to boost engagement.',
      features: [
        'Sparks conversation and clicks',
        'Active for the lifetime of the feature',
        'Available to all CYBAs',
      ],
      buttonText: 'Unlock Pinned Comment',
      buttonLink: '#',
      type: 'boost',
    },
    {
      name: 'Short-Form Clips ( 1 per week )',
      price: 5,
      description: 'Transform your long videos into short viral clips',
      features: [
        'One short-form clip created per week',
        'Clipped from your existing long-form content',
        'Formatted for Reels, Shorts, and TikTok',
        'No custom b-roll or effects',
        'Available to all CYBAs',
      ],
      buttonText: 'Unlock Short-Form Clips',
      buttonLink: '#',
      type: 'boost',
    },
    {
      name: 'Monthly Strategy Session',
      price: 5,
      description: 'One 30-minute strategy session per month focused on your goals, content, and next moves.',
      features: [
        'Get clarity on what o focus on this month',
        'Align your content with your goals',
        'Available to all CYBAs',
        'Light accountability, low pressure',
      ],
      buttonText: 'Unlock Monthly Strategy Session',
      buttonLink: '#',
      type: 'boost',
    },
];

const rewards = [
    {
      name: 'Short-Form Clip',
      price: 500,
      description: 'Convert one long video into a short-form clip.',
      features: [
        'One short-form clip created',
        'No custom b-roll or effects',
        '60 seconds max',
        'Available to Surge & Charge CYBAs',
        'Redeemable with CYBACOIN',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
    {
      name: 'Studio Time - ManMadeStudios',
      price: 1500,
      description: 'Get 1 hour of studio time at ManMadeStudios.',
      features: [
        '1 hour studio session at ManMadeStudios',
        'Available to Surge & Charge CYBAs',
        'Redeemable with CYBACOIN',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
    {
      name: 'Feature Ad Boost',
      price: 600,
      description: 'Apply a one-time Feature Ad Boost to a selected feature to increase its reach and engagement.',
      features: [
        'One-Time Feature Ad Boost',
        'You choose the selected feature',
        'Increased reach and engagement',
        'Available to all CYBAs',
        'Redeemable with CYBACOIN',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
    {
      name: 'Saturday Spotlight (Single Feature)',
      price: 900,
      description: 'Get an extra feature for the week that\'s posted on Saturday for increased exposure. *Saturday Spotlight features are bonus highlights and do not impact Top CYBAS of the Week rankings.*',
      features: [
        'One extra feature posted on Saturday',
        'High attention posting window',
        'Available to all CYBAs',
        'Redeemable with CYBACOIN',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
    {
      name: 'CYBAZONE Playlist Placement',
      price: 850,
      description: 'Add one song to the CYBAZONE Spotify playlist for one week.',
      features: [
        'One song added to the CYBAZONE Spotify playlist',
        'You choose the song',
        'Redeemable with CYBACOIN',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
    {
      name: 'Strategy Session',
      price: 1800,
      description: 'Get a 30-minute strategy session focused on your content, brand, and growth.',
      features: [
        'One one-on-one strategy session',
        'Personalized guidance and feedback',
        'Available to all CYBAs',
        'Redeemable with CYBACOIN',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
    {
      name: 'Pinned Comment',
      price: 300,
      description: 'Pin a custom comment on one selected feature to drive attention and engagement.',
      features: [
        'One pinned comment on a selected feature',
        'Comment remains pinned forever',
        'Available to all CYBAs',
        'Redeemable with CYBACOIN',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
    {
      name: 'Video Shoot - JAJAUNSTIEFFMEDIA',
      price: 4500,
      description: 'Get a professional video shoot to elevate your visuals and content.',
      features: [
        'Professional video shoot experience',
        'Ideal for content, promos, or visual',
        'Surge CYBAs only',
        'Redeemable with CYBACOIN',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
    {
      name: 'Photoshoot - JAJAUNSTIEFFMEDIA',
      price: 2500,
      description: 'Get a professional Photoshoot with Jajuan Stieff to upgrade your visuals and content.',
      features: [
        'Professional photoshoot session',
        'Available to Surge & Charge CYBAs',
        'Redeemable with CYBACOIN',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
    {
      name: 'Story Takeover (Single Feature)',
      price: 350,
      description: 'Get a selected feature shared to the CYBAZONE story.',
      features: [
        'One feature shared to CYBAZONE story',
        'Increased visibility',
        'Available to all CYBAs',
        'Redeemable with CYBACOIN',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
    {
      name: 'Priority Feature Post',
      price: 500,
      description: 'Apply a one-time Priority Boost to move a selected feature ahead in the posting queue',
      features: [
        'Priority placement for one selected feature',
        'Redeemable with CYBACOIN',
        'Available to all CYBAs',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
    {
      name: 'Interview',
      price: 1800,
      description: 'Get featured in a recorded interview designed to spotlight your story and creative journey.',
      features: [
        'Recorded interview feature',
        'Redeemable with CYBACOIN',
        'Available to Surge & Charge Members',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
    {
      name: 'Free Week',
      price: 2500,
      description: 'Get one free week of your current CYBAZONE membership.',
      features: [
        'One free week of CYBAZONE membership',
        'Applies to your current tier',
        'No payment required for that week',
        'Available to Surge & Charge CYBAs',
      ],
      buttonText: 'Redeem',
      buttonLink: '#',
      type: 'reward',
    },
];
  
export const seedInitialExtras = async (db: Firestore) => {
    const extrasCollectionRef = collection(db, 'extras');

    // Start a batch
    const batch = writeBatch(db);

    // 1. Delete all existing documents in the 'extras' collection
    const existingDocsSnapshot = await getDocs(extrasCollectionRef);
    existingDocsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    // 2. Add all boosts with an order
    boosts.forEach((boost, index) => {
        const docRef = doc(extrasCollectionRef); // Create a new doc reference
        batch.set(docRef, { ...boost, order: index + 1 });
    });

    // 3. Add all rewards with an order
    rewards.forEach((reward, index) => {
        const docRef = doc(extrasCollectionRef); // Create a new doc reference
        batch.set(docRef, { ...reward, order: index + 1 });
    });

    // Commit the batch
    await batch.commit();
};

    