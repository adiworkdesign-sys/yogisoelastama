export const netflixLogoSrc = new URL('../Netflix logo.svg', import.meta.url).href;
export const primeLogoSrc = new URL('../Amazon_Prime_Video_logo 1.svg', import.meta.url).href;

export const getProjectClientLogo = (projectId: string) => {
  if (projectId === '02 - LDR Scream of Tyrannosaurus') {
    return { src: netflixLogoSrc, alt: 'Netflix' };
  }
  if (projectId === '03 - Secret Level Concord') {
    return { src: primeLogoSrc, alt: 'Prime Video' };
  }
  return null;
};
