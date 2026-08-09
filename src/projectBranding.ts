export const netflixLogoSrc = new URL('../Netflix logo.svg', import.meta.url).href;
export const primeLogoSrc = new URL('../Amazon_Prime_Video_logo 1.svg', import.meta.url).href;
export const wizardsLogoSrc = new URL('../Wizards_of_the_Coast_logo.png', import.meta.url).href;

type ProjectClientLogo = {
  src: string;
  alt: string;
  desktopWidth?: string;
};

export const getProjectClientLogo = (projectId: string): ProjectClientLogo | null => {
  if (projectId === '02 - LDR Scream of Tyrannosaurus') {
    return { src: netflixLogoSrc, alt: 'Netflix' };
  }
  if (projectId === '03 - Secret Level Concord') {
    return { src: primeLogoSrc, alt: 'Prime Video' };
  }
  if (
    projectId === '08 - MTG Dawn of Phyrexian Invasion'
    || projectId === '09 - MTG March of the Machines'
  ) {
    return {
      src: wizardsLogoSrc,
      alt: 'Wizards of the Coast',
      desktopWidth: 'clamp(240px, 24vw, 430px)',
    };
  }
  return null;
};
