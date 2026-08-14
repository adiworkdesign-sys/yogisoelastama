export const netflixLogoSrc = new URL('../Netflix logo.svg', import.meta.url).href;
export const primeLogoSrc = new URL('../Amazon_Prime_Video_logo 1.svg', import.meta.url).href;
export const wizardsLogoSrc = new URL('../Wizards_of_the_Coast_logo.png', import.meta.url).href;
export const loveDeathRobotsLogoSrc = '/assets/logos/projects/love-death-robots-official.png';
export const secretLevelLogoSrc = '/assets/logos/projects/secret-level-official-source.svg';

type ProjectClientLogo = {
  src: string;
  alt: string;
  brand: 'love-death-robots' | 'secret-level' | 'wizards';
  desktopWidth?: string;
};

export const getProjectClientLogo = (projectId: string): ProjectClientLogo | null => {
  if (projectId === '02 - LDR Scream of Tyrannosaurus') {
    return {
      src: loveDeathRobotsLogoSrc,
      alt: 'Love, Death & Robots',
      brand: 'love-death-robots',
      desktopWidth: 'clamp(250px, 27vw, 470px)',
    };
  }
  if (projectId === '03 - Secret Level Concord') {
    return {
      src: secretLevelLogoSrc,
      alt: 'Secret Level',
      brand: 'secret-level',
      desktopWidth: 'clamp(320px, 34vw, 600px)',
    };
  }
  if (
    projectId === '08 - MTG Dawn of Phyrexian Invasion'
    || projectId === '09 - MTG March of the Machines'
  ) {
    return {
      src: wizardsLogoSrc,
      alt: 'Wizards of the Coast',
      brand: 'wizards',
      desktopWidth: 'clamp(240px, 24vw, 430px)',
    };
  }
  return null;
};
