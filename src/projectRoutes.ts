type RoutableProject = {
  id: string;
  title: string;
};

const projectSlugById: Record<string, string> = {
  '01 - Leviathan RCG': 'rcg-mining-tool',
  '02 - LDR Scream of Tyrannosaurus': 'love-death-robot-season-4-scream-of-the-tyrannosaurus',
  '03 - Secret Level Concord': 'secret-level-season-1-concord',
  '04 - Leviathan Caterpillar': 'caterpillar',
  '05 - Leviathan Icebreaker': 'icebreaker',
  '06 - Fallen Angel': 'fallen-angel',
  '07 - Long Exile': 'long-exile',
  '08 - MTG Dawn of Phyrexian Invasion': 'magic-the-gathering-dawn-of-the-phyrexian-invasion',
  '09 - MTG March of the Machines': 'magic-the-gathering-march-of-the-machines',
  '10 - Godkiller': 'godkiller',
};

const legacyProjectSlugsById: Record<string, string[]> = {
  '01 - Leviathan RCG': ['leviathan-rcg'],
  '03 - Secret Level Concord': ['secret-level-concord'],
  '04 - Leviathan Caterpillar': ['leviathan-caterpillar'],
  '05 - Leviathan Icebreaker': ['leviathan-icebreaker'],
  '08 - MTG Dawn of Phyrexian Invasion': ['mtg-dawn-of-phyrexian-invasion'],
  '09 - MTG March of the Machines': ['mtg-march-of-the-machines'],
};

const slugify = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const decodeRouteParam = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const getProjectSlug = (project: RoutableProject) => (
  projectSlugById[project.id] ?? slugify(project.title)
);

export const getProjectPath = (project: RoutableProject) => (
  `/project/${getProjectSlug(project)}`
);

export const findProjectByRouteParam = <T extends RoutableProject>(
  projects: readonly T[],
  routeParam?: string,
) => {
  if (!routeParam) return undefined;

  const decodedParam = decodeRouteParam(routeParam);
  const normalizedParam = decodedParam.toLowerCase();

  return projects.find((project) => (
    project.id === decodedParam
    || getProjectSlug(project) === normalizedParam
    || legacyProjectSlugsById[project.id]?.includes(normalizedParam)
  ));
};
