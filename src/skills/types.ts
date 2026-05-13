export type SkillManifest = {
  name: string;
  description: string;
  path: string;
};

export type SkillDocument = {
  manifest: SkillManifest;
  body: string;
};
